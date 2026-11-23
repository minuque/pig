import { useEventListener } from "@vueuse/core"
import type { MaybeRefOrGetter } from "vue"
import { formatContextReference, sessionReference } from "@pig/protocol"
import { SESSION_DROP_EVENT, type DroppedSession } from "@features/session-nav/index.js"

export function useSessionDrop(
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
  insert: (markdown: string) => void,
): void {
  useEventListener(target, SESSION_DROP_EVENT, (event: Event) => {
    const sessions = (event as CustomEvent<readonly DroppedSession[]>).detail
    const markdown = sessions
      .map((session) => formatContextReference(sessionReference(session.id, session.title)))
      .join(" ")

    if (markdown) insert(markdown)
  })
}
