import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import { platformRequest } from "@client/http.js"

/** 协议列表不带的卡片事实：磁盘总条数 + 当前模型。 */
export interface SessionCardRecord {
  messageCount: number
  model?: { provider: string; id: string }
}

/**
 * 会话卡片 adapter：给窗口总条数和侧栏脚注。
 * 失败不挡主路径；连接后与 Session 列表戳变化时刷新。
 */
export function useSessionCards(
  connected: MaybeRefOrGetter<boolean>,
  sessions: MaybeRefOrGetter<readonly { id: string; updatedAt?: number; createdAt: number }[]>,
) {
  const sessionCards = shallowRef(new Map<string, SessionCardRecord>())
  const sessionStamp = computed(() =>
    toValue(sessions)
      .map((session) => `${session.id}:${session.updatedAt ?? session.createdAt}`)
      .join("|"),
  )

  async function loadSessionCards() {
    if (!toValue(connected)) return
    try {
      const result = await platformRequest<{ cards: (SessionCardRecord & { id: string })[] }>(
        "/api/v1/platform/session-cards",
      )
      sessionCards.value = new Map(
        result.cards.map((card) => [
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
