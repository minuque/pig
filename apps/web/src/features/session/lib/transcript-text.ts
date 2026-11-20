import type { TranscriptItem } from "@/types/common-type.js"

export function transcriptText(item: TranscriptItem): string {
  if (item.role === "task") return ""
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
}

const MENTION_BLOCK_SUFFIX = /\n\n(?:<file name="[^"]*">[\s\S]*?<\/file>\n?)+$/
const SKILL_BLOCK_PREFIX = /^<skill name="([^"]+)"[^>]*>[\s\S]*?<\/skill>(?:\n\n)?/

export function stripExpansionBlocks(text: string): string {
  let next = text.replace(MENTION_BLOCK_SUFFIX, "")
  const skill = SKILL_BLOCK_PREFIX.exec(next)

  if (skill) next = `/skill:${skill[1]} ${next.slice(skill[0].length)}`.trimEnd()
  return next
}

export function userMessageText(item: TranscriptItem): string {
  return stripExpansionBlocks(transcriptText(item))
}
