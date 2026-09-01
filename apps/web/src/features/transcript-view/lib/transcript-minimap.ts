/** 对齐 Codex 会话 minimap：刻度按用户句锚点在正文里的实际位置。 */

import type { TimelineRow } from "@features/transcript-view/lib/transcript-rows.js"

export const MINIMAP_MIN_ITEMS = 2
/** 无实测正文宽时的 gutter 回退，对齐自适应上限。 */
export const MINIMAP_CONTENT_MAX_WIDTH = 920
export const MINIMAP_HIT_STRIP_LEFT = 12
export const MINIMAP_HIT_STRIP_MAX_WIDTH = 40
/** 与 Waku `NAVIGATION_RAIL_PITCH` / `w-11` 一致。 */
export const MINIMAP_RAIL_PITCH = 12
export const MINIMAP_RAIL_WIDTH = 44

export interface TranscriptMinimapItem {
  id: string
  rowIndex: number
  userText: string | null
  assistantText: string | null
}

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
  return "80cqh"
}

export function resolveMinimapAnchorPercent(offset: number, scrollHeight: number): number {
  if (!(scrollHeight > 0) || !Number.isFinite(offset)) return 0
  return Math.max(0, Math.min(100, Math.round((offset / scrollHeight) * 1000) / 10))
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

export function sameNumberList(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
