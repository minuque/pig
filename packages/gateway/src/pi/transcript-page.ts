import type { TranscriptItem } from "@pig/protocol"

export const LIGHT_TOOL_TEXT = 4_000

export function lightTranscript(items: readonly TranscriptItem[]): TranscriptItem[] {
  return items.map((item) => {
    if (item.role !== "tool") return item
    let truncated = false
    const content = item.content.map((part) => {
      if (part.type !== "text" || part.text.length <= LIGHT_TOOL_TEXT) return part
      truncated = true
      return { ...part, text: part.text.slice(0, LIGHT_TOOL_TEXT) }
    })
    return truncated ? { ...item, content, truncated } : item
  })
}
