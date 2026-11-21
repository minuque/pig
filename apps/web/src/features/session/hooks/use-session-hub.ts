import { reactive, watch } from "vue"
import type { GatewaySession } from "@client/gateway-session.js"
import type { useGatewayClient } from "@client/gateway-connection.js"
import { createAbortableOpen } from "@features/session/hooks/abortable-open.js"
import { createBackgroundSender } from "@features/session/hooks/use-background-send.js"
import { createHistoryStore } from "@features/session/hooks/use-session-history.js"
import { useLiveSubscriptions } from "@features/session/hooks/use-live-subscriptions.js"
import type { BackgroundIdleResult } from "@features/session/hooks/use-live-subscriptions.js"
import type { sessionState } from "@features/session/lib/session-state.js"

export type SessionHub = ReturnType<typeof createSessionHub>

export interface ForegroundEntry {
  remote(): GatewaySession | undefined
  handOver(): void
  reattach(): Promise<void>
}

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
  const foregrounds = new Set<ForegroundEntry>()

  pi.bindAttachedReconnect(async () => {
    await pi.client.value?.reconnect()

    let failure: unknown

    for (const entry of foregrounds) {
      try {
        await entry.reattach()
      } catch (error) {
        failure ??= error
      }
    }

    if (failure) throw failure
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

  function claim(id: string, by: ForegroundEntry) {
    for (const entry of foregrounds) if (entry !== by && entry.remote()?.id === id) entry.handOver()
  }

  function setBackgroundIdle(handler?: (id: string) => Promise<BackgroundIdleResult>) {
    live.setBackgroundIdle(handler)
  }

  async function dispose() {
    stopClientSync()
    pi.bindAttachedReconnect()
    setBackgroundIdle()

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
    setBackgroundIdle,
    dispose,
  }
}
