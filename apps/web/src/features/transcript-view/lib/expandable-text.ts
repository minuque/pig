/** 展开后视口最多渲染这么多行；更长的内容在此窗口内虚拟滚动。 */
export const DEFAULT_MAX_EXPAND_LINES = 32
export const DEFAULT_LINE_HEIGHT_PX = 21
export const DEFAULT_OVERSCAN_LINES = 8

export const TOOL_OMIT_HEAD = 5
export const TOOL_OMIT_TAIL = 4

export function hiddenLineCount(lineCount: number): number {
  return Math.max(0, lineCount - TOOL_OMIT_HEAD - TOOL_OMIT_TAIL + 1)
}

const MARKDOWN_VIRTUAL_CHARS = 8_000
const MARKDOWN_VIRTUAL_LINES = 80

export function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split(/\r?\n/)
}

/** 按滚动位置切出当前要挂载的行区间（含 overscan）。 */
export function visibleLineRange(
  scrollTop: number,
  lineHeight: number,
  viewportLines: number,
  totalLines: number,
  overscan: number,
): { start: number; end: number } {
  if (totalLines === 0) return { start: 0, end: 0 }

  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / lineHeight))
  const start = Math.max(0, first - overscan)
  const end = Math.min(totalLines, first + viewportLines + overscan)

  return { start, end }
}

/** 长预览才用行窗口，避免短文本也建虚拟列表。 */
export function shouldVirtualizeMarkdown(text: string): boolean {
  return text.length > MARKDOWN_VIRTUAL_CHARS || splitLines(text).length > MARKDOWN_VIRTUAL_LINES
}
