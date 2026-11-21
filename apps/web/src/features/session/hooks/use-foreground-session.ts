import { computed, shallowRef, type ComputedRef } from "vue"
import { GatewaySession, type SessionState } from "@client/gateway-session.js"
import type { ContextUsageEstimate, ModelRef, ThinkingLevel } from "@/types/common-type.js"
import type { useGatewayClient } from "@client/gateway-connection.js"
import { contextUsage } from "@client/platform.js"
import { useHistoryView } from "@features/session/hooks/use-session-history.js"
import type { SessionHub } from "@features/session/hooks/use-session-hub.js"
import {
  isDisconnectedError,
  isOpenAborted,
  isSessionLocked,
} from "@features/session/hooks/abortable-open.js"
import {
  hasRunningTasks,
  type ForegroundOwner,
  type LiveSubscription,
} from "@features/session/hooks/use-live-subscriptions.js"
import { useSessionFileWatch } from "@features/session/hooks/use-session-file-watch.js"

interface CreateSessionInput {
  cwd: string
  model?: ModelRef
  thinkingLevel?: ThinkingLevel
}

export function useForegroundSession(
  pi: Pick<ReturnType<typeof useGatewayClient>, "client" | "connected">,
  sessionId: ComputedRef<string | undefined>,
  hub: SessionHub,
) {
  const remote = shallowRef<GatewaySession>()
  const state = shallowRef<SessionState>()
  const contextUsageEstimate = shallowRef<ContextUsageEstimate>()
  let contextUsageRequest = 0
  let activeSub: LiveSubscription | undefined
  let replaceChain: Promise<void> = Promise.resolve()
  let abortInflightOpen: (() => void) | undefined
  const { raceRemoteOpen, discard, live } = hub
  const history = useHistoryView(hub.history)
  const owner: ForegroundOwner = {
    state: (next) => {
      state.value = next
    },
    revision: (id) => void refreshContextUsage(id),
  }
  const entry = { remote: () => remote.value, handOver, reattach }
  const unregister = hub.registerForeground(entry)

  function clearContextUsage() {
    contextUsageRequest += 1
    contextUsageEstimate.value = undefined
  }

  async function refreshContextUsage(id: string) {
    const request = ++contextUsageRequest

    try {
      const usage = await contextUsage(id)

      if (request !== contextUsageRequest || remote.value?.id !== id) return
      contextUsageEstimate.value = usage ?? undefined
    } catch {}
  }

  function handOver() {
    if (activeSub) live.moveToBackground(activeSub)
    activeSub = undefined
    clearForeground()
  }

  function promote(id: string) {
    hub.claim(id, entry)
    const sub = live.promoteBackground(id, owner)

    if (!sub) return false
    activeSub = sub
    remote.value = sub.session

    if (sub.lastState) state.value = sub.lastState
    return true
  }

  function clearForeground() {
    clearContextUsage()
    remote.value = undefined
    state.value = undefined
  }

  function attach(next: GatewaySession) {
    const previous = remote.value

    detach()

    if (previous && previous !== next) void discard(previous)
    activeSub = live.subscribeLive(next, owner)
    remote.value = next
  }

  function detach() {
    const id = remote.value?.id

    if (id) history.releaseLive(id)
    activeSub?.stop()
    activeSub = undefined
    clearForeground()
  }

  function release() {
    const previous = remote.value
    const sub = activeSub
    const id = previous?.id

    if (sub && id && (sub.running || hasRunningTasks(sub))) {
      live.moveToBackground(sub)
      activeSub = undefined
      clearForeground()
      return
    }

    detach()

    if (previous) void discard(previous)
  }

  function dropRemote(current: GatewaySession) {
    const id = current.id

    detach()
    void discard(current)

    if (id) void history.loadHistory(id, { force: true })
  }

  async function reattach() {
    const current = remote.value

    if (!current) return

    try {
      await current.reattach()
    } catch (error) {
      if (!isSessionLocked(error)) throw error
      dropRemote(current)
    }
  }

  function enqueueReplace<T>(run: () => Promise<T>): Promise<T> {
    const next = replaceChain.then(run, run)
    replaceChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  function showHistory(id: string) {
    if (history.activeId.value !== id) abortInflightOpen?.()
    history.setActive(id)
    void history.loadHistory(id)

    if (remote.value?.id === id) return
    abortInflightOpen?.()
    release()
    promote(id)
  }

  function ensureRemote(id: string, options?: { takeover?: boolean }) {
    if (remote.value?.id === id) return Promise.resolve()
    return enqueueReplace(async () => {
      if (history.activeId.value !== id || remote.value?.id === id || !pi.client.value) return
      release()

      if (promote(id)) return

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const current = pi.client.value

        if (!current || history.activeId.value !== id) return
        const raced = raceRemoteOpen(id, () => GatewaySession.open(current, id, options))
        abortInflightOpen = raced.abort

        try {
          const next = await raced.promise

          if (history.activeId.value !== id) {
            await discard(next)
            return
          }

          attach(next)
          return
        } catch (error) {
          if (history.activeId.value !== id || isOpenAborted(error)) return

          if (isSessionLocked(error)) {
            void history.loadHistory(id, { force: true })
            throw error
          }

          if (!isDisconnectedError(error)) throw error

          if (attempt === 0 && pi.connected.value) continue

          if (pi.connected.value) throw error
          return
        } finally {
          if (abortInflightOpen === raced.abort) abortInflightOpen = undefined
        }
      }
    })
  }

  function dropChanged(id: string) {
    const current = remote.value

    if (current?.id === id) dropRemote(current)
  }

  const externalTurn = computed(
    () => history.externalTurn.value && remote.value?.id !== history.activeId.value,
  )

  async function takeover() {
    const id = history.activeId.value

    if (id) await ensureRemote(id, { takeover: true })
  }

  const fileWatch = useSessionFileWatch({
    client: pi.client,
    connected: pi.connected,
    sessionId: history.activeId,
    attached: computed(() => remote.value?.id),
    pooled: (id) => live.backgroundSubscription(id) !== undefined,
    changed: (id) => void history.refreshHistory(id),
  })

  async function createRemoteSession(nextCwd: string, options?: Omit<CreateSessionInput, "cwd">) {
    const routeSessionAtStart = sessionId.value
    return enqueueReplace(async () => {
      const target = pi.client.value

      if (!target) throw new Error("Gateway 未连接")

      const next = await GatewaySession.create(target, {
        cwd: nextCwd,
        ...(options?.model !== undefined ? { model: options.model } : {}),
        ...(options?.thinkingLevel !== undefined ? { thinkingLevel: options.thinkingLevel } : {}),
      })

      if (sessionId.value !== routeSessionAtStart) {
        await discard(next)
        return undefined
      }

      history.setActive(next.id)
      attach(next)
      return next.id
    })
  }

  async function dispose() {
    fileWatch.stop()
    unregister()
    history.setActive(undefined)
    abortInflightOpen?.()
    abortInflightOpen = undefined
    release()
  }

  function leaveForeground() {
    history.setActive(undefined)
    abortInflightOpen?.()
    abortInflightOpen = undefined
    release()
  }

  return {
    remote,
    state,
    live,
    history,
    contextUsage: contextUsageEstimate,
    externalTurn,
    takeover,
    dropChanged,
    release,
    ensureRemote,
    createRemoteSession,
    showHistory,
    leaveForeground,
    dispose,
  }
}
