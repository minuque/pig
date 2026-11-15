import { reactive, watch } from "vue"
import type { GatewaySession } from "@client/gateway-session.js"
import type { useGatewayClient } from "@client/gateway-connection.js"
import { createAbortableOpen } from "@features/session/hooks/abortable-open.js"
import { createBackgroundSender } from "@features/session/hooks/use-background-send.js"
import { createHistoryStore } from "@features/session/hooks/use-session-history.js"
import { useLiveSubscriptions } from "@features/session/hooks/use-live-subscriptions.js"
import type { sessionState } from "@features/session/lib/session-state.js"

export type SessionHub = ReturnType<typeof createSessionHub>

/** 一侧的前台：当前挂着的连接，以及把它交给另一侧的办法。 */
export interface ForegroundEntry {
  remote(): GatewaySession | undefined
  handOver(): void
}

/** 两侧 workbench 共用的会话底座：历史缓存、后台池、在飞的 open、每会话的客户端状态。 */
export function createSessionHub(
  pi: Pick<ReturnType<typeof useGatewayClient>, "client" | "connected" | "bindAttachedReconnect">,
) {
  const history = createHistoryStore()
  const { raceRemoteOpen, discard } = createAbortableOpen()
  const live = useLiveSubscriptions({ history, discard })
  const states = reactive(new Map<string, ReturnType<typeof sessionState>>())
  const backgroundSend = createBackgroundSender({
    states,
    backgroundSubscription: live.backgroundSubscription,
    transcriptFor: history.transcriptFor,
  })
  /** 每侧挂着的前台连接；断线后客户端只重连一次，再把每侧的会话挂到新连接上。 */
  const foregrounds = new Set<ForegroundEntry>()

  pi.bindAttachedReconnect(async () => {
    await pi.client.value?.reconnect()

    for (const entry of foregrounds) await entry.remote()?.reattach()
  })

  const stopClientSync = watch(
    () => pi.connected.value,
    (connected) => {
      if (!connected) live.dropBackground()
    },
  )

  function registerForeground(entry: ForegroundEntry) {
    foregrounds.add(entry)
    return () => foregrounds.delete(entry)
  }

  /** 一侧要显示另一侧前台上的会话：那一侧先把连接交进池里，接手的一侧再从池里取。 */
  function claim(id: string, by: ForegroundEntry) {
    for (const entry of foregrounds) if (entry !== by && entry.remote()?.id === id) entry.handOver()
  }

  async function dispose() {
    stopClientSync()
    pi.bindAttachedReconnect()

    for (const sub of live.takeBackground()) await discard(sub.session)
  }

  return {
    history,
    live,
    raceRemoteOpen,
    discard,
    states,
    backgroundSend,
    registerForeground,
    claim,
    dispose,
  }
}
