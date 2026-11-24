import {
  contextTextForDisplay,
  splitContextEnvelope,
  splitContextText,
  type ContextReference,
  type ContextTextSegment,
} from "@pig/protocol"
import type { TranscriptItem } from "@/types/common-type.js"

export function transcriptText(item: TranscriptItem): string {
  if (item.role === "task" || item.role === "system") return ""
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
}

const MENTION_BLOCK_SUFFIX = /\n\n(?:<file name="[^"]*">[\s\S]*?<\/file>\n?)+$/
// 外部：Pi 把 /skill:name 展开成开头 <skill> 块 + args
const SKILL_BLOCK_PREFIX = /^<skill name="([^"]+)"[^>]*>[\s\S]*?<\/skill>(?:\n\n)?/

function stripContextFreeBlocks(text: string): string {
  const withoutFiles = text.replace(MENTION_BLOCK_SUFFIX, "")
  const skill = SKILL_BLOCK_PREFIX.exec(withoutFiles)
  return skill
    ? `/skill:${skill[1]} ${withoutFiles.slice(skill[0].length)}`.trimEnd()
    : withoutFiles
}

export function stripExpansionBlocks(text: string): string {
  const { body } = splitContextEnvelope(text)
  const clean = stripContextFreeBlocks(body)
  return contextTextForDisplay(body === text ? clean : `${clean}${text.slice(body.length)}`)
}

export function userMessageText(item: TranscriptItem): string {
  return stripExpansionBlocks(transcriptText(item))
}

export function userMessageParts(item: TranscriptItem): ContextTextSegment[] {
  const { body, references } = splitContextEnvelope(transcriptText(item))
  return splitContextText(stripContextFreeBlocks(body), references)
}

function sameContextReference(left: ContextReference, right: ContextReference): boolean {
  if (left.kind !== right.kind || left.sessionId !== right.sessionId || left.label !== right.label)
    return false

  if (left.kind === "session") return true
  return (
    right.kind === "reply" &&
    left.entryId === right.entryId &&
    left.text === right.text &&
    (left.comment ?? "") === (right.comment ?? "")
  )
}

export function sameContextSegments(
  left: readonly ContextTextSegment[] = [],
  right: readonly ContextTextSegment[] = [],
): boolean {
  if (left === right) return true

  if (left.length !== right.length) return false
  return left.every((segment, index) => {
    const other = right[index]

    if (!other || segment.kind !== other.kind) return false

    if (segment.kind === "text" && other.kind === "text") return segment.text === other.text
    return (
      segment.kind === "reference" &&
      other.kind === "reference" &&
      sameContextReference(segment.reference, other.reference)
    )
  })
}
