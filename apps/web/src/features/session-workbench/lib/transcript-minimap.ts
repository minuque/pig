/** 对齐 Waku ConversationNavigationRail：正文列左侧紧凑刻度，按用户句跳转。 */

export const MINIMAP_MIN_ITEMS = 2;
/** 与 `--size-content`（732px）一致，gutter 按居中正文列计算。 */
export const MINIMAP_CONTENT_MAX_WIDTH = 732;
export const MINIMAP_PERSISTENT_GUTTER = 48;
export const MINIMAP_HIT_STRIP_LEFT = 12;
export const MINIMAP_HIT_STRIP_MAX_WIDTH = 40;
/** 与 Waku `NAVIGATION_RAIL_PITCH` / `w-11` 一致。 */
export const MINIMAP_RAIL_PITCH = 12;
export const MINIMAP_RAIL_WIDTH = 44;

export interface MinimapSourceRow {
  id: string;
  role: string;
  text: string;
}

export interface TranscriptMinimapItem {
  id: string;
  rowIndex: number;
  userText: string | null;
  assistantText: string | null;
}

export function compactMinimapPreview(text: string | null | undefined): string | null {
  const compact = text?.replace(/\s+/g, " ").trim() ?? "";
  return compact.length > 0 ? compact : null;
}

function lastAssistantText(rows: readonly MinimapSourceRow[], userRowIndex: number): string | null {
  let assistantText: string | null = null;
  for (let index = userRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;
    if (row.role === "user") break;
    if (row.role === "assistant") assistantText = compactMinimapPreview(row.text);
  }
  return assistantText;
}

export function deriveTranscriptMinimapItems(
  rows: readonly MinimapSourceRow[],
): TranscriptMinimapItem[] {
  const items: TranscriptMinimapItem[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || row.role !== "user") continue;
    items.push({
      id: row.id,
      rowIndex: index,
      userText: compactMinimapPreview(row.text),
      assistantText: lastAssistantText(rows, index),
    });
  }
  return items;
}

export function resolveMinimapHeightStyle(itemCount: number): string {
  if (itemCount <= 0) return "0px";
  return `min(${itemCount * MINIMAP_RAIL_PITCH}px, 80%)`;
}

export function resolveMinimapHitAreaWidth(hitStripWidth: number): number {
  if (hitStripWidth <= 0) return 0;
  return MINIMAP_RAIL_WIDTH;
}

export function resolveMinimapTopPercent(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  if (itemCount === 1) return 50;
  const clamped = Math.max(0, Math.min(index, itemCount - 1));
  return ((clamped + 0.5) / itemCount) * 100;
}

export function resolveMinimapIndexFromPointer(input: {
  readonly itemCount: number;
  readonly railTop: number;
  readonly railHeight: number;
  readonly pointerY: number;
}): number | null {
  if (input.itemCount <= 0 || input.railHeight <= 0) return null;
  if (input.itemCount === 1) return 0;
  const slot = input.railHeight / input.itemCount;
  const index = Math.floor((input.pointerY - input.railTop) / slot);
  return Math.max(0, Math.min(input.itemCount - 1, index));
}

function sideGutter(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 0;
  const contentWidth = Math.min(viewportWidth, MINIMAP_CONTENT_MAX_WIDTH);
  return Math.max(0, (viewportWidth - contentWidth) / 2);
}

export function resolveMinimapHasPersistentGutter(viewportWidth: number): boolean {
  return sideGutter(viewportWidth) >= MINIMAP_PERSISTENT_GUTTER;
}

export function resolveMinimapHitStripWidth(viewportWidth: number): number {
  const gutter = sideGutter(viewportWidth);
  if (gutter <= 0) return 0;
  return Math.max(
    0,
    Math.min(MINIMAP_HIT_STRIP_MAX_WIDTH, Math.floor(gutter) - MINIMAP_HIT_STRIP_LEFT),
  );
}

export function minimapRowInView(
  rowTop: number,
  rowHeight: number,
  scrollTop: number,
  scrollBottom: number,
): boolean {
  return rowTop < scrollBottom && rowTop + Math.max(1, rowHeight) > scrollTop;
}

export function sameIdList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
