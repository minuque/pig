import type { InjectionKey } from "vue"

export { transcriptText, userMessageText } from "@features/session/lib/transcript-text.js"

export { prefetchHighlighter } from "@features/transcript-view/lib/code-highlight.js"

export function prefetchTranscriptView(): void {
  void import("@features/transcript-view/components/TranscriptBody.vue")
}

export { latestToolTasks, taskDetail } from "@features/transcript-view/lib/tool-tasks.js"

export const openTaskSessionKey: InjectionKey<
  (target: { sessionId: string; agent: string }) => void
> = Symbol("open-task-session")

export interface OpenFileTarget {
  path: string
  line?: number | undefined
  endLine?: number | undefined
  find?: string | undefined
}

export const openFileKey: InjectionKey<{
  open: (target: OpenFileTarget) => void
  reveal: (raw: string) => void
  accepts: (raw: string) => boolean
}> = Symbol("open-file")
