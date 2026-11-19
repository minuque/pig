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

/** 一侧 workbench 的前台连接：挂上、摘下、切换、转入共用后台池、释放。每侧同一时刻只有一条。 */
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

  /** 占用估算只给前台：切走或换会话就作废在飞的请求。 */
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
    } catch {
      /* 占用估算失败不挡主流程 */
    }
  }

  /** 另一侧要显示这个会话：连接不管是否在跑都转进池里，由那一侧取走。 */
  function handOver() {
    if (activeSub) live.moveToBackground(activeSub)
    activeSub = undefined
    clearForeground()
  }

  /** 后台池命中就把该会话挂回前台，复用同一条连接；在另一侧前台上就先让那一侧交出来。 */
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

  /** 网关那边的运行时已不可用：放掉连接并强制重拉历史，下次发送重新挂上。 */
  function dropRemote(current: GatewaySession) {
    const id = current.id

    detach()
    void discard(current)

    if (id) void history.loadHistory(id, { force: true })
  }

  /** 重连后重新挂上；被 session_locked 拒绝就放掉连接，回到只读并重拉历史。 */
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

  /** 命令被拒为 session_changed_elsewhere：网关已释放运行时，这一侧放掉连接。 */
  function dropChanged(id: string) {
    const current = remote.value

    if (current?.id === id) dropRemote(current)
  }

  /** 别处在跑回合：缓存页带标记且这一侧没挂这个会话。 */
  const externalTurn = computed(
    () => history.externalTurn.value && remote.value?.id !== history.activeId.value,
  )

  async function takeover() {
    const id = history.activeId.value

    if (id) await ensureRemote(id, { takeover: true })
  }

  /** 显示中却没挂连接：按需 watch 会话文件，外部追加时立刻重拉，不再走定时轮询。 */
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

  /** 这一侧卸下：运行中的会话照旧转入共用后台池，池本身由 hub 收尾。 */
  async function dispose() {
    fileWatch.stop()
    unregister()
    history.setActive(undefined)
    abortInflightOpen?.()
    abortInflightOpen = undefined
    release()
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
