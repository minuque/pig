import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import type { SessionCard } from "@/types/session-type.js"
import { listSessionCards } from "@client/platform.js"

/** 连接后与 Session id 集合变化时拉卡片；失败不挡列表。不用 updatedAt 当刷新键。 */
export function useSessionCards(
  connected: MaybeRefOrGetter<boolean>,
  sessions: MaybeRefOrGetter<readonly { id: string; updatedAt?: number; createdAt: number }[]>,
) {
  const sessionCards = shallowRef(new Map<string, Omit<SessionCard, "id">>())
  const sessionStamp = computed(() =>
    toValue(sessions)
      .map((session) => session.id)
      .join("|"),
  )

  async function loadSessionCards() {
    if (!toValue(connected)) return
    try {
      const cards = await listSessionCards()
      sessionCards.value = new Map(
        cards.map((card) => [
          card.id,
          {
            messageCount: card.messageCount,
            ...(card.model ? { model: card.model } : {}),
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
      if (isConnected) void loadSessionCards()
    },
    { immediate: true },
  )
  watch(sessionStamp, () => {
    void loadSessionCards()
  })

  return { sessionCards, loadSessionCards }
}
