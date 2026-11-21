import { shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionCard } from "@/types/common-type.js"
import { listSessionCards } from "@client/platform.js"

export function useSessionCards(connected: MaybeRefOrGetter<boolean>) {
  const sessionCards = shallowRef(new Map<string, Omit<SessionCard, "id">>())

  async function loadSessionCards() {
    try {
      const cards = await listSessionCards()
      sessionCards.value = new Map(
        cards.map((card) => [
          card.id,
          {
            messageCount: card.messageCount,
            ...(card.model ? { model: card.model } : {}),
            ...(card.outcome ? { outcome: card.outcome } : {}),
          },
        ]),
      )
    } catch {}
  }

  watch(
    () => toValue(connected),
    (isConnected) => {
      if (!isConnected) return
      void loadSessionCards()
    },
    { immediate: true },
  )
  return { sessionCards }
}
