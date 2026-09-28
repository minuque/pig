import { shallowRef } from "vue"
import type { RemoteSession } from "@earendil-works/pi-coding-agent/client"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type { RemoteSessionState, TranscriptItem } from "@/types/common-type.js"
import { contextUsage } from "@client/platform.js"
import type { useSessionHistory } from "@features/session-workbench/hooks/use-session-history.js"
import { coalesceByFrame } from "@features/session-workbench/lib/coalesce-by-frame.js"

/** 一条 Session 的 live 订阅：前台写 state，后台只覆盖 live 与拉历史，发布逻辑两处共用。 */
export interface LiveSubscription {
  session: RemoteSession
  foreground: boolean
  running: boolean
  /** 后台空闲正在交给接管者（泵队/收尾），期间重复的空闲快照不重复触发。 */
  idlePending: boolean
  usageRevision: number | undefined
  lastState: RemoteSessionState | undefined
  liveItems: Map<string, TranscriptItem>
  stop: () => void
}

/** 后台空闲接管结果：sent 表示已泵出一条留在池里，done 表示可以出池收尾。 */
export type BackgroundIdleResult = "sent" | "done"

interface LiveDeps {
  history: ReturnType<typeof useSessionHistory>
  discard(session: RemoteSession): Promise<void>
  foregroundId(): string | undefined
  onForegroundState(state: RemoteSessionState): void
}

/** 运行中的 Session 继续订阅：切走不停订，跑完或断线才放连接。 */
export function useLiveSubscriptions(deps: LiveDeps) {
  const { history, discard, foregroundId, onForegroundState } = deps
  const background = new Map<string, LiveSubscription>()
  const backgroundRunningIds = shallowRef<ReadonlySet<string>>(new Set())
  const contextUsageEstimate = shallowRef<ContextUsageEstimate>()
  let contextUsageRequest = 0
  let backgroundIdleHandler: ((id: string) => Promise<BackgroundIdleResult>) | undefined

  /** 接管后台会话空闲后的泵队与收尾；不注册就直接出池。 */
  function setBackgroundIdle(fn?: (id: string) => Promise<BackgroundIdleResult>) {
    backgroundIdleHandler = fn
  }

  /** 占用估算只给前台：切走或换会话就作废在飞的请求。 */
  function clearContextUsage() {
    contextUsageRequest += 1
    contextUsageEstimate.value = undefined
  }

  async function refreshContextUsage(id: string | undefined) {
    if (!id) return
    const request = ++contextUsageRequest

    try {
      const usage = await contextUsage(id)

      if (request !== contextUsageRequest || foregroundId() !== id) return
      contextUsageEstimate.value = usage ?? undefined
    } catch {
      /* 占用估算失败不挡主流程 */
    }
  }

  function syncBackgroundRunning() {
    const next = new Set<string>()

    for (const [id, sub] of background) if (sub.running) next.add(id)
    const previous = backgroundRunningIds.value

    if (next.size !== previous.size || [...next].some((id) => !previous.has(id)))
      backgroundRunningIds.value = next
  }

  /** 摘出后台池并作废其临时 live 覆盖：连接不可续，切回时靠重拉对齐。 */
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

  /** 断线：清掉后台连接，切回时重新 open。 */
  function dropBackground() {
    for (const sub of takeBackground()) void discard(sub.session)
  }

  /** 后台会话跑完：临时 id 作废并补一次历史收尾，然后放掉连接出池。 */
  function retireBackground(sub: LiveSubscription) {
    const id = sub.session.id

    if (!id || background.get(id) !== sub) return
    background.delete(id)
    history.releaseLive(id)
    sub.stop()
    void discard(sub.session)
    syncBackgroundRunning()
  }

  /** 订阅 Session：live 覆盖缓存、revision 重拉历史；前台写 state 与用量，后台跑完就出池。 */
  function subscribeLive(session: RemoteSession, foreground: boolean): LiveSubscription {
    const sub: LiveSubscription = {
      session,
      foreground,
      running: false,
      idlePending: false,
      usageRevision: undefined,
      lastState: undefined,
      liveItems: new Map(),
      stop: () => {},
    }
    const publish = (nextState: RemoteSessionState) => {
      sub.lastState = nextState

      if (sub.foreground) onForegroundState(nextState)

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

        if (sub.foreground) refreshContextUsage(id)

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
          // 先等磁盘 id 就位，泵出的乐观句锚点才对得上历史
          if (!reloaded) await history.loadHistory(id, { force: true })

          // submit 要等整轮才 resolve，期间到达的 idle 快照会被 idlePending 丢掉：
          // 每泵出一条就重拉历史再跑一轮，直到队列空（done）或会话重新 running
          while (handed && background.get(id) === sub && !sub.running) {
            handed = (await handler(id)) === "sent"

            if (handed && background.get(id) === sub && !sub.running)
              await history.loadHistory(id, { force: true })
          }
        } catch {
          /* 接管失败按收尾处理，队列回滚由接管者负责 */
        } finally {
          sub.idlePending = false
        }

        // 还在池里且彻底空闲才收尾；重新 running 的会话等下一个 idle 快照
        if (background.get(id) === sub && !sub.running) retireBackground(sub)
      })()
    }
    const coalesced = coalesceByFrame<RemoteSessionState>(publish, 8)
    // 快照广播会清空库内 progress，同一帧里后到的空快照会盖掉先到的 item_finished：按 id 逐事件累积
    const unsubscribe = session.subscribe((nextState) => {
      for (const item of nextState.transcript) sub.liveItems.set(item.id, item)
      coalesced.push(nextState)
    })

    sub.stop = () => {
      unsubscribe()
      coalesced.cancel()
    }

    return sub
  }

  /** 后台池里该会话的订阅；后台泵队与接管前核对连接用。 */
  function backgroundSubscription(id: string) {
    return background.get(id)
  }

  /** 切走前台：还在运行就转后台继续订阅。 */
  function moveToBackground(sub: LiveSubscription) {
    const id = sub.session.id

    if (!id) return
    sub.foreground = false
    background.set(id, sub)
    syncBackgroundRunning()
  }

  /** 后台池里有该会话就挂回前台，复用同一条连接。 */
  function promoteBackground(id: string) {
    const sub = background.get(id)

    if (!sub) return undefined
    background.delete(id)
    syncBackgroundRunning()
    sub.foreground = true
    refreshContextUsage(id)
    return sub
  }

  return {
    backgroundRunningIds,
    contextUsage: contextUsageEstimate,
    clearContextUsage,
    subscribeLive,
    moveToBackground,
    promoteBackground,
    backgroundSubscription,
    setBackgroundIdle,
    takeBackground,
    dropBackground,
  }
}
