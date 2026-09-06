import type { TimelineRow, TranscriptMinimapItem } from "@features/transcript-view/type.js"

export const MINIMAP_MIN_ITEMS = 2
export const MINIMAP_CONTENT_MAX_WIDTH = 920
export const MINIMAP_HIT_STRIP_LEFT = 12
export const MINIMAP_HIT_STRIP_MAX_WIDTH = 40
export const MINIMAP_RAIL_PITCH = 12
export const MINIMAP_RAIL_WIDTH = 44

function compactMinimapPreview(text: string | null | undefined): string | null {
  const compact = text?.replace(/\s+/g, " ").trim() ?? ""
  return compact.length > 0 ? compact : null
}

export function deriveTranscriptMinimapItems(
  rows: readonly TimelineRow[],
): TranscriptMinimapItem[] {
  const items: TranscriptMinimapItem[] = []
  let assistantText: string | null = null
  let sawAssistant = false
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (!row) continue
    if (row.role === "assistant") {
      if (!sawAssistant) {
        assistantText = compactMinimapPreview(row.text)
        sawAssistant = true
      }
      continue
    }
    if (row.role !== "user") continue
    items.push({
      id: row.id,
      rowIndex: index,
      userText: compactMinimapPreview(row.text),
      assistantText,
    })
    assistantText = null
    sawAssistant = false
  }

  items.reverse()
  return items
}

export function resolveMinimapHeightStyle(itemCount: number): string {
  if (itemCount <= 0) return "0px"
  return `min(${itemCount * MINIMAP_RAIL_PITCH}px, 80%)`
}

export function resolveMinimapTopPercent(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0
  if (itemCount === 1) return 50

  const clamped = Math.max(0, Math.min(index, itemCount - 1))
  return ((clamped + 0.5) / itemCount) * 100
}

function sideGutter(viewportWidth: number, contentWidth = MINIMAP_CONTENT_MAX_WIDTH): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0

  const used =
    Number.isFinite(contentWidth) && contentWidth > 0
      ? Math.min(viewportWidth, contentWidth)
      : Math.min(viewportWidth, MINIMAP_CONTENT_MAX_WIDTH)

  return Math.max(0, (viewportWidth - used) / 2)
}

export function resolveMinimapHitStripWidth(
  viewportWidth: number,
  contentWidth = MINIMAP_CONTENT_MAX_WIDTH,
): number {
  const gutter = sideGutter(viewportWidth, contentWidth)
  if (gutter <= 0) return 0

  return Math.max(
    0,
    Math.min(MINIMAP_HIT_STRIP_MAX_WIDTH, Math.floor(gutter) - MINIMAP_HIT_STRIP_LEFT),
  )
}

export function sameIdList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
