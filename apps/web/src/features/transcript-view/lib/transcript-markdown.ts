import type { InjectionKey } from "vue"

export const transcriptScrollRootKey: InjectionKey<() => HTMLElement | null> = Symbol(
  "pig.transcriptScrollRoot",
)

const SLOT_LINE_PX = 26
const SLOT_MIN_PX = 48
const SLOT_MAX_PX = 640

/** 历史消息未挂 Markdown 时的占位高度，避免先 0 再撑开。 */
export function estimateMarkdownSlotPx(text: string, linePx = SLOT_LINE_PX): number {
  if (!text) return SLOT_MIN_PX
  const lines = text.split("\n").length
  return Math.min(SLOT_MAX_PX, Math.max(SLOT_MIN_PX, lines * linePx))
}
