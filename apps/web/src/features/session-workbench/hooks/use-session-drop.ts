import { useEventListener } from "@vueuse/core"
import type { Ref } from "vue"
import { formatContextReference, sessionReference } from "@pig/protocol"
import { SESSION_DROP_EVENT, type DroppedSession } from "@features/session-nav/index.js"

interface ReferenceTarget {
  $el: HTMLElement
  insertMarkdown(markdown: string): void
}

export function useSessionDrop(composer: Readonly<Ref<ReferenceTarget | null>>): void {
  useEventListener(
    () => composer.value?.$el,
    SESSION_DROP_EVENT,
    (event: Event) => {
      const sessions = (event as CustomEvent<readonly DroppedSession[]>).detail
      const markdown = sessions
        .map((session) => formatContextReference(sessionReference(session.id, session.title)))
        .join(" ")

      if (markdown) composer.value?.insertMarkdown(markdown)
    },
  )
}
