import { shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue"
import { useEventListener } from "@vueuse/core"
import type { SessionCard, WorkspaceGit } from "@/types/common-type.js"
import { listSessionCards, listWorkspaceGit } from "@client/platform.js"

export function useSessionCards(connected: MaybeRefOrGetter<boolean>) {
  const sessionCards = shallowRef(new Map<string, Omit<SessionCard, "id">>())
  const workspaceGit = shallowRef<ReadonlyMap<string, WorkspaceGit>>(new Map())

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

  async function loadWorkspaceGit() {
    try {
      workspaceGit.value = new Map(Object.entries(await listWorkspaceGit()))
    } catch {}
  }

  watch(
    () => toValue(connected),
    (isConnected) => {
      if (!isConnected) return
      void loadSessionCards()
      void loadWorkspaceGit()
    },
    { immediate: true },
  )
  useEventListener("focus", () => {
    if (toValue(connected)) void loadWorkspaceGit()
  })
  return { sessionCards, workspaceGit }
}
