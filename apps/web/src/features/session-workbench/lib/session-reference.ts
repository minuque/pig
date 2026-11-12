import type { TranscriptItem } from "@/types/common-type.js"
import { sessionTranscript } from "@client/platform.js"
import { transcriptText, userMessageText } from "@features/transcript-view/index.js"

/** 会话正文转成 Markdown：只留用户与助手的文字，工具调用不带。 */
export function sessionMarkdown(title: string, items: readonly TranscriptItem[]): string {
  const parts = [`# ${title}`]

  for (const item of items) {
    const text = (item.role === "user" ? userMessageText(item) : transcriptText(item)).trim()

    if (!text || (item.role !== "user" && item.role !== "assistant")) continue
    parts.push(`## ${item.role === "user" ? "User" : "Assistant"}\n\n${text}`)
  }

  return `${parts.join("\n\n")}\n`
}

/** 拖进输入区的会话：整段正文作为一个 Markdown 附件。 */
export async function sessionReferenceFile(session: { id: string; title: string }): Promise<File> {
  const { items } = await sessionTranscript(session.id)
  const name = session.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || session.id
  return new File([sessionMarkdown(session.title, items)], `${name}.md`, { type: "text/markdown" })
}
