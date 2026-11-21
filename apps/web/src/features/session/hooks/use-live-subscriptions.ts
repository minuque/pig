import { shallowRef } from "vue"
import type { GatewaySession, SessionState } from "@client/gateway-session.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { HistoryStore } from "@features/session/hooks/use-session-history.js"
import { coalesceByFrame } from "@features/session/lib/coalesce-by-frame.js"
import { NO_TOOL_STARTS, recordToolStartedAt } from "@features/session/lib/transcript-timeline.js"

export interface ForegroundOwner {
  state(next: SessionState): void
  revision(id: string): void
}

export interface LiveSubscription {
  session: GatewaySession
  foreground: boolean
  owner: ForegroundOwner | undefined
  running: boolean
  idlePending: boolean
  usageRevision: number | undefined
  lastState: SessionState | undefined
  liveItems: Map<string, TranscriptItem>
  toolStartedAt: Map<string, number>
  stop: () => void
}

export type BackgroundIdleResult = "sent" | "done"

export function hasRunningTasks(sub: LiveSubscription): boolean {
  return (
    sub.lastState?.snapshot?.tasks.some(
      (task) => task.status === "running" || task.status === "queued",
    ) ?? false
  )
}

interface LiveDeps {
  history: HistoryStore
  discard(session: GatewaySession): Promise<void>
}

export function useLiveSubscriptions(deps: LiveDeps) {
  const { history, discard } = deps
  const background = new Map<string, LiveSubscription>()
  const subscriptions = new Map<string, LiveSubscription>()
  const backgroundRunningIds = shallowRef<ReadonlySet<string>>(new Set())
  let backgroundIdleHandler: ((id: string) => Promise<BackgroundIdleResult>) | undefined

  function setBackgroundIdle(fn?: (id: string) => Promise<BackgroundIdleResult>) {
    backgroundIdleHandler = fn
  }

  function syncBackgroundRunning() {
    const next = new Set<string>()

    for (const [id, sub] of background) if (sub.running) next.add(id)
    const previous = backgroundRunningIds.value

    if (next.size !== previous.size || [...next].some((id) => !previous.has(id)))
      backgroundRunningIds.value = next
  }

  function takeBackground() {
    const pooled = [...background.values()]

    background.clear()
    syncBackgroundRunning()

    for (const sub of pooled) {
      const id = sub.session.id

      if (id) history.releaseLive(id)
      sub.stop()
    }

    return pooled
  }

  function dropBackground() {
    for (const sub of takeBackground()) void discard(sub.session)
  }

  function retireBackground(sub: LiveSubscription) {
    const id = sub.session.id

    if (!id || background.get(id) !== sub || hasRunningTasks(sub)) return
    background.delete(id)
    history.releaseLive(id)
    sub.stop()
    void discard(sub.session)
    syncBackgroundRunning()
  }

  function subscribeLive(session: GatewaySession, owner?: ForegroundOwner): LiveSubscription {
    const sub: LiveSubscription = {
      session,
      foreground: owner !== undefined,
      owner,
      running: false,
      idlePending: false,
      usageRevision: undefined,
      lastState: undefined,
      liveItems: new Map(),
      toolStartedAt: new Map(),
      stop: () => {},
    }
    const publish = (nextState: SessionState) => {
      sub.lastState = nextState

      sub.owner?.state(nextState)

      if (nextState.snapshot) {
        const running = nextState.snapshot.phase !== "idle"

        if (running !== sub.running) {
          sub.running = running

          if (!sub.foreground) syncBackgroundRunning()
        }
      }

      const id = session.id

      if (sub.liveItems.size > 0 && id) history.overlayLive(id, [...sub.liveItems.values()])
      const revision = nextState.snapshot?.revision
      let reloaded = false

      if (id && revision !== undefined && revision !== sub.usageRevision) {
        const hadRevision = sub.usageRevision !== undefined
        sub.usageRevision = revision

        sub.owner?.revision(id)

        if (hadRevision) {
          reloaded = true
          void history.loadHistory(id, { force: true })
        } else void history.loadHistory(id)
      }

      if (sub.foreground || sub.running) return

      const handler = backgroundIdleHandler

      if (!handler || !id) {
        if (!reloaded && id) void history.loadHistory(id, { force: true })
        retireBackground(sub)
        return
      }

      if (sub.idlePending) return
      sub.idlePending = true
      void (async () => {
        let handed = true

        try {
          if (!reloaded) await history.loadHistory(id, { force: true })

          while (handed && background.get(id) === sub && !sub.running) {
            handed = (await handler(id)) === "sent"

            if (handed && background.get(id) === sub && !sub.running)
              await history.loadHistory(id, { force: true })
          }
        } catch {
        } finally {
          sub.idlePending = false
        }

        if (background.get(id) === sub && !sub.running) retireBackground(sub)
      })()
    }
    const coalesced = coalesceByFrame<SessionState>(publish, 8)
    const unsubscribe = session.subscribe((nextState) => {
      for (const item of nextState.transcript) {
        sub.liveItems.set(item.id, item)
        recordToolStartedAt(sub.toolStartedAt, item)
      }

      coalesced.push(nextState)
    })

    sub.stop = () => {
      unsubscribe()
      coalesced.cancel()

      const id = session.id

      if (id && subscriptions.get(id) === sub) subscriptions.delete(id)
    }

    const id = session.id

    if (id) subscriptions.set(id, sub)
    return sub
  }

  function toolStartedAtFor(id: string): ReadonlyMap<string, number> {
    return subscriptions.get(id)?.toolStartedAt ?? NO_TOOL_STARTS
  }

  function backgroundSubscription(id: string) {
    return background.get(id)
  }

  function moveToBackground(sub: LiveSubscription) {
    const id = sub.session.id

    if (!id) return
    sub.foreground = false
    sub.owner = undefined
    background.set(id, sub)
    syncBackgroundRunning()
  }

  function promoteBackground(id: string, owner: ForegroundOwner) {
    const sub = background.get(id)

    if (!sub) return undefined
    background.delete(id)
    syncBackgroundRunning()
    sub.foreground = true
    sub.owner = owner
    owner.revision(id)
    return sub
  }

  return {
    backgroundRunningIds,
    subscribeLive,
    moveToBackground,
    promoteBackground,
    backgroundSubscription,
    toolStartedAtFor,
    setBackgroundIdle,
    takeBackground,
    dropBackground,
  }
}
