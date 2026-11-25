import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import { useEventListener } from "@vueuse/core"
import type { SessionCard, WorkspaceGit } from "@/types/common-type.js"
import { listSessionCards } from "@client/platform.js"

export function useSessionCards(
  connected: MaybeRefOrGetter<boolean>,
  snapshotGit: MaybeRefOrGetter<Readonly<Record<string, WorkspaceGit>>>,
  refreshWorkspaceGit: () => void,
) {
  const sessionCards = shallowRef(new Map<string, Omit<SessionCard, "id">>())
  const workspaceGit = computed<ReadonlyMap<string, WorkspaceGit>>(
    () => new Map(Object.entries(toValue(snapshotGit))),
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
  useEventListener("focus", () => {
    if (toValue(connected)) refreshWorkspaceGit()
  })
  return { sessionCards, workspaceGit }
}
