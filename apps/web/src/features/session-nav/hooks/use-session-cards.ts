import { shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionCard } from "@/types/session-type.js"
import { listSessionCards } from "@client/platform.js"

/** 连上后全量拉一次卡片；按工作目录局部刷新另接。失败不挡列表。 */
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
    } catch {
      /* 卡片条数失败不挡会话主路径 */
    }
  }

  watch(
    () => toValue(connected),
    (isConnected) => {
      if (!isConnected) return
      void loadSessionCards()
    },
    { immediate: true },
  )
  return { sessionCards, loadSessionCards }
}
