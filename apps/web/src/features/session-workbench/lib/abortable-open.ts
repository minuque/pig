import type { RemoteSession } from "@earendil-works/pi-coding-agent/client"

const OPEN_ABORTED = "open-aborted"

export function isOpenAborted(error: unknown) {
  return error instanceof Error && error.message === OPEN_ABORTED
}

/** SDK 的 open 完成后才交出实例；用 race 在切换时丢掉等待，结束后再 dispose。 */
export function raceRemoteOpen(start: () => Promise<RemoteSession>) {
  let aborted = false
  let rejectAbort = (_error: Error) => {}
  const abortWait = new Promise<never>((_, reject) => {
    rejectAbort = reject
  })
  const opening = start()
  return {
    abort() {
      if (aborted) return
      aborted = true
      rejectAbort(new Error(OPEN_ABORTED))
    },
    promise: Promise.race([opening, abortWait]).then(
      async (session) => {
        if (aborted) {
          await session.dispose()
          throw new Error(OPEN_ABORTED)
        }
        return session
      },
      (error: unknown) => {
        void opening.then(
          (session) => session.dispose(),
          () => undefined,
        )
        throw error
      },
    ),
  }
}
