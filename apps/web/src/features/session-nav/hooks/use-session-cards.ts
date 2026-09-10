import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionCard } from "@/types/session-type.js"
import { listSessionCards } from "@client/platform.js"

/** HTTP 拉卡片，不挡 WebSocket；失败不挡列表。不用 updatedAt 当刷新键。 */
export function useSessionCards(
  connected: MaybeRefOrGetter<boolean>,
  sessions: MaybeRefOrGetter<readonly { id: string; updatedAt?: number; createdAt: number }[]>,
  refreshKey?: MaybeRefOrGetter<string | undefined>,
) {
  const sessionCards = shallowRef(new Map<string, Omit<SessionCard, "id">>())
  const sessionStamp = computed(() =>
    toValue(sessions)
      .map((session) => session.id)
      .join("|"),
  )

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
    () => {
      void loadSessionCards()
    },
    { immediate: true },
  )
  watch(sessionStamp, () => {
    void loadSessionCards()
  })
  if (refreshKey !== undefined) {
    watch(
      () => toValue(refreshKey),
      () => void loadSessionCards(),
    )
  }

  return { sessionCards, loadSessionCards }
}
