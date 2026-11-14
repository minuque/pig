import type { InjectionKey } from "vue"

export { transcriptText } from "@features/transcript-view/lib/transcript-format.js"

export { userMessageText } from "@features/transcript-view/lib/transcript-format.js"

export { prefetchHighlighter } from "@features/transcript-view/lib/code-highlight.js"

export function prefetchTranscriptView(): void {
  void import("@features/transcript-view/components/TranscriptBody.vue")
}

export { latestToolTasks, taskDetail } from "@features/transcript-view/lib/tool-tasks.js"

/** 时间线里的任务行用它打开子会话；没人提供时任务行不可点。 */
export const openTaskSessionKey: InjectionKey<
  (target: { sessionId: string; agent: string }) => void
> = Symbol("open-task-session")
/** 时间线里的文件路径用它在 Files 面板打开；没人提供时路径不可点。 */
export const openFileKey: InjectionKey<
  (target: { path: string; line?: number | undefined; endLine?: number | undefined }) => void
> = Symbol("open-file")
