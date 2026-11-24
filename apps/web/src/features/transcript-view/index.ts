import type { Anchor } from "@ui-sdk/core"
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

export { transcriptModelsKey } from "@features/transcript-view/lib/transcript-models.js"

export { default as TranscriptStatus } from "@features/transcript-view/components/TranscriptStatus.vue"

export interface QuoteReplyRequest {
  sessionId: string
  entryId: string
  text: string
  anchor: Anchor
  range?: Range | undefined
}

export interface ReplyJumpRequest {
  sessionId: string
  entryId: string
  text?: string | undefined
}

export interface ReplyJumpTarget extends ReplyJumpRequest {
  seq: number
}

export const quoteReplyKey: InjectionKey<(request: QuoteReplyRequest) => void> =
  Symbol("quote-reply")
export const navigateReplyKey: InjectionKey<(target: ReplyJumpRequest) => void> =
  Symbol("navigate-reply")
