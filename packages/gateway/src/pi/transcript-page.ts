import type { TranscriptItem } from "@pig/protocol"

/** 历史里单段工具文本的上限；超出部分展开时再取。 */
export const LIGHT_TOOL_TEXT = 4_000

/** 打开会话发的轻量形态：工具的大块文本截到开头并标记，其余原样。 */
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
