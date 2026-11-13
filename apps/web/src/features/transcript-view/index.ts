import type { InjectionKey } from "vue"

export { transcriptText } from "@features/transcript-view/lib/transcript-format.js"

export { userMessageText } from "@features/transcript-view/lib/transcript-format.js"

export { prefetchHighlighter } from "@features/transcript-view/lib/code-highlight.js"

export function prefetchTranscriptView(): void {
  void import("@features/transcript-view/components/TranscriptBody.vue")
}

export { latestToolTasks } from "@features/transcript-view/lib/tool-tasks.js"

/** 时间线里的任务行用它打开子会话；没人提供时任务行不可点。 */
export const openTaskSessionKey: InjectionKey<
  (target: { sessionId: string; agent: string }) => void
> = Symbol("open-task-session")
