import { computed, watch, type Ref } from "vue"
import { t } from "@i18n/index.js"
import { userPreferences } from "@client/preferences.js"
import { pushNotification, resolveNotification } from "@pig/ui/notification"
import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import type { ExtensionUiContext } from "@features/extension-ui/index.js"
import { askBoard } from "@features/extension-ui/lib/board.js"
import { sessionTitle, untitledSession } from "@features/session/index.js"
import { notifySystem } from "@features/settings/index.js"

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
    sound: { play(event: "input"): unknown }
  },
) {
  const noticeId = (id: string) => `waiting:${id}`

  watch(
    () => [waiting.value, deps.shownIds.value] as const,
    ([next, shown], previous) => {
      const before = previous?.[0] ?? new Map<string, WaitingKind>()

      for (const id of before.keys())
        if (!next.has(id) || shown.includes(id)) resolveNotification(noticeId(id))

      for (const [id, kind] of next) {
        if (before.get(id) === kind) continue
        const meta = deps.sessions.value.find((item) => item.id === id)
        const sessionName = meta ? sessionTitle(meta) : untitledSession()
        const waitingLabel = t(
          kind === "confirm" ? "session.waitingConfirm" : "session.waitingAnswer",
        )

        if (userPreferences.value.notifyInput) {
          void deps.sound.play("input")
          void notifySystem({
            title: waitingLabel,
            body: sessionName,
            onClick: () => deps.open(id),
            enabled: true,
          })
        }

        if (shown.includes(id)) continue
        pushNotification({
          id: noticeId(id),
          title: waitingLabel,
          body: sessionName,
          tone: "warning",
          keepUntilResolved: true,
          sessionId: id,
          avatar: meta?.cwd ? { kind: "project", cwd: meta.cwd } : { kind: "brand" },
          actions: [{ label: t("session.openSession"), primary: true, run: () => deps.open(id) }],
        })
      }
    },
  )
}
