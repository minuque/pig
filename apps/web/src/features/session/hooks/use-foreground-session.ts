import { shallowRef, type ComputedRef } from "vue"
import { GatewaySession } from "@client/gateway-session.js"
import type { ModelRef, SessionState, ThinkingLevel } from "@/types/common-type.js"
import type { useGatewayClient } from "@client/gateway-connection.js"
import type { useSessionHistory } from "@features/session/hooks/use-session-history.js"
import {
  createAbortableOpen,
  isDisconnectedError,
  isOpenAborted,
} from "@features/session/hooks/abortable-open.js"
import {
  hasRunningTasks,
  useLiveSubscriptions,
  type LiveSubscription,
} from "@features/session/hooks/use-live-subscriptions.js"

interface CreateSessionInput {
  cwd: string
  model?: ModelRef
  thinkingLevel?: ThinkingLevel
}

/** 前台会话的连接：挂上、摘下、切换、转入后台池、释放。同一时刻只有一条前台连接。 */
export function useForegroundSession(
  pi: ReturnType<typeof useGatewayClient>,
  sessionId: ComputedRef<string | undefined>,
  history: ReturnType<typeof useSessionHistory>,
) {
  const remote = shallowRef<GatewaySession>()
  const state = shallowRef<SessionState>()
  let activeSub: LiveSubscription | undefined
  let replaceChain: Promise<void> = Promise.resolve()
  let abortInflightOpen: (() => void) | undefined
  const { raceRemoteOpen, discard } = createAbortableOpen()
  const live = useLiveSubscriptions({
    history,
    discard,
    foregroundId: () => remote.value?.id,
    onForegroundState: (next) => {
      state.value = next
    },
  })

  /** 后台池命中就把该会话挂回前台，复用同一条连接。 */
  function promote(id: string) {
    const sub = live.promoteBackground(id)

    if (!sub) return false
    activeSub = sub
    remote.value = sub.session

    if (sub.lastState) state.value = sub.lastState
    return true
  }

  function clearForeground() {
    live.clearContextUsage()
    remote.value = undefined
    state.value = undefined
  }

  function attach(next: GatewaySession) {
    const previous = remote.value

    detach()

    if (previous && previous !== next) void discard(previous)
    activeSub = live.subscribeLive(next, true)
    remote.value = next
  }

  function detach() {
    const id = remote.value?.id

    if (id) history.releaseLive(id)
    activeSub?.stop()
    activeSub = undefined
    clearForeground()
  }

  /** 切走前台会话：回合或后台任务还在跑就转入后台订阅池，否则放弃连接。 */
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

  function ensureRemote(id: string) {
    if (remote.value?.id === id) return Promise.resolve()
    return enqueueReplace(async () => {
      if (history.activeId.value !== id || remote.value?.id === id || !pi.client.value) return
      release()

      if (promote(id)) return

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const current = pi.client.value

        if (!current || history.activeId.value !== id) return
        const raced = raceRemoteOpen(id, () => GatewaySession.open(current, id))
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
    history.setActive(undefined)
    abortInflightOpen?.()
    abortInflightOpen = undefined
    const current = remote.value
    const pooled = live.takeBackground()

    detach()

    for (const sub of pooled) await discard(sub.session)

    if (current) await discard(current)
  }

  /** 回到新建页：只放下前台，运行中的会话留在后台池继续订阅。 */
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
    release,
    ensureRemote,
    createRemoteSession,
    showHistory,
    leaveForeground,
    dispose,
  }
}
