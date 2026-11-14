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

/** 要打开的文件：line 定位到行，find 定位到这段文本所在的行。 */
export interface OpenFileTarget {
  path: string
  line?: number | undefined
  endLine?: number | undefined
  find?: string | undefined
}

/** 时间线里的文件路径用它在 Files 面板打开；accepts 判断一个链接是不是工作区内的文件。没人提供时路径不可点。 */
export const openFileKey: InjectionKey<{
  open: (target: OpenFileTarget) => void
  accepts: (raw: string) => boolean
}> = Symbol("open-file")
