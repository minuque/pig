import type { RemoteSession } from "@earendil-works/pi-coding-agent/client"

const OPEN_ABORTED = "open-aborted"

export function isOpenAborted(error: unknown) {
  return error instanceof Error && error.message === OPEN_ABORTED
}

export function isDisconnectedError(error: unknown) {
  if (!error || typeof error !== "object") return false
  if ("name" in error && error.name === "PiDisconnectedError") return true
  return error instanceof Error && /disconnected/i.test(error.message)
}

function swallowDispose(session: RemoteSession) {
  return Promise.resolve()
    .then(() => session.dispose())
    .then(
      () => undefined,
      () => undefined,
    )
}

interface Opening {
  promise: Promise<RemoteSession>
  waiters: number
}

/** 同 ID 复用未完成的 open；无 waiter 时 dispose。不同 ID 只中止等待。 */
export function createAbortableOpen() {
  const openings = new Map<string, Opening>()
  const disposals = new Map<string, Promise<void>>()

  function trackDisposal(id: string, work: Promise<void>) {
    const previous = disposals.get(id) ?? Promise.resolve()
    const chained = previous.then(
      () => work,
      () => work,
    )
    disposals.set(id, chained)
    void chained.finally(() => {
      if (disposals.get(id) === chained) disposals.delete(id)
    })
    return chained
  }

  function discard(session: RemoteSession) {
    const id = session.id
    if (!id) return swallowDispose(session)
    return trackDisposal(id, swallowDispose(session))
  }

  async function beginOpen(id: string, start: () => Promise<RemoteSession>) {
    const pending = disposals.get(id)
    if (pending) await pending
    return start()
  }

  function ensureOpening(id: string, start: () => Promise<RemoteSession>) {
    const existing = openings.get(id)
    if (existing) return existing
    const created: Opening = {
      waiters: 0,
      promise: beginOpen(id, start).then(async (session) => {
        if (created.waiters === 0) {
          if (openings.get(id) === created) openings.delete(id)
          await discard(session)
          throw new Error(OPEN_ABORTED)
        }
        return session
      }),
    }
    openings.set(id, created)
    void created.promise.then(
      () => {
        if (openings.get(id) === created) openings.delete(id)
      },
      () => {
        if (openings.get(id) === created) openings.delete(id)
      },
    )
    return created
  }

  function raceRemoteOpen(id: string, start: () => Promise<RemoteSession>) {
    const opening = ensureOpening(id, start)
    opening.waiters += 1
    let aborted = false
    let rejectAbort = (_error: Error) => {}
    const abortWait = new Promise<never>((_, reject) => {
      rejectAbort = reject
    })
    return {
      abort() {
        if (aborted) return
        aborted = true
        opening.waiters -= 1
        rejectAbort(new Error(OPEN_ABORTED))
      },
      promise: Promise.race([opening.promise, abortWait]).then(
        async (session) => {
          if (aborted) {
            if (opening.waiters === 0) await discard(session)
            throw new Error(OPEN_ABORTED)
          }
          return session
        },
        (error: unknown) => {
          throw error
        },
      ),
    }
  }

  return { raceRemoteOpen, discard }
}
