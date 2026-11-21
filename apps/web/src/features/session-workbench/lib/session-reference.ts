import type { TranscriptItem } from "@/types/common-type.js"
import { sessionTranscript } from "@client/platform.js"
import { transcriptText, userMessageText } from "@features/transcript-view/index.js"

export function sessionMarkdown(title: string, items: readonly TranscriptItem[]): string {
  const parts = [`# ${title}`]

  for (const item of items) {
    const text = (item.role === "user" ? userMessageText(item) : transcriptText(item)).trim()

    if (!text || (item.role !== "user" && item.role !== "assistant")) continue
    parts.push(`## ${item.role === "user" ? "User" : "Assistant"}\n\n${text}`)
  }

  return `${parts.join("\n\n")}\n`
}

export async function sessionReferenceFile(session: { id: string; title: string }): Promise<File> {
  const { items } = await sessionTranscript(session.id)
  const name = session.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || session.id
  return new File([sessionMarkdown(session.title, items)], `${name}.md`, { type: "text/markdown" })
}
