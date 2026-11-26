import { computed, watch, type Ref } from "vue"
import { t } from "@i18n/index.js"
import { dismissNotice, notify } from "@pig/ui/toast"
import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import type { ExtensionUiContext } from "@features/extension-ui/index.js"
import { askBoard } from "@features/extension-ui/lib/board.js"
import { sessionTitle, untitledSession } from "@features/session/index.js"

type WaitingKind = "confirm" | "answer"

interface WaitingSource {
  sessions: Ref<readonly SessionMetadata[]>
  dialogs: ExtensionUiContext["dialogs"]
  isReady(id: string): boolean
  transcriptFor(id: string): readonly TranscriptItem[]
}

export function waitingSessions(source: WaitingSource) {
  return computed(() => {
    const waiting = new Map<string, WaitingKind>()

    for (const { sessionId, request } of source.dialogs.value)
      if (!waiting.has(sessionId))
        waiting.set(sessionId, request.method === "confirm" ? "confirm" : "answer")

    for (const { id } of source.sessions.value)
      if (!waiting.has(id) && source.isReady(id) && askBoard(source.transcriptFor(id)))
        waiting.set(id, "answer")
    return waiting
  })
}

export function useWaitingNotices(
  waiting: Ref<ReadonlyMap<string, WaitingKind>>,
  deps: {
    sessions: Ref<readonly SessionMetadata[]>
    shownIds: Ref<readonly (string | undefined)[]>
    open(id: string): void
  },
) {
  const noticeId = (id: string) => `waiting:${id}`

  watch(
    () => [waiting.value, deps.shownIds.value] as const,
    ([next, shown], previous) => {
      const before = previous?.[0] ?? new Map<string, WaitingKind>()

      for (const id of before.keys())
        if (!next.has(id) || shown.includes(id)) dismissNotice(noticeId(id))

      for (const [id, kind] of next) {
        if (before.get(id) === kind || shown.includes(id)) continue
        const meta = deps.sessions.value.find((item) => item.id === id)
        notify(meta ? sessionTitle(meta) : untitledSession(), "waiting", {
          id: noticeId(id),
          title: t(kind === "confirm" ? "session.waitingConfirm" : "session.waitingAnswer"),
          action: { label: t("session.openSession"), run: () => deps.open(id) },
        })
      }
    },
  )
}
