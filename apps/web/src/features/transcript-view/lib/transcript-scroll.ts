import type { MarkstreamThreadVirtualState } from "markstream-vue"

/** 打开会话只恢复行高缓存，去掉会把视口滚走的锚点。 */
export function threadStateHeightsOnly(
  state: MarkstreamThreadVirtualState | null,
): MarkstreamThreadVirtualState | null {
  if (!state) return null
  const { outerAnchor: _outerAnchor, ...rest } = state
  return rest
}

/** 与 Markstream 新增行的精确贴底阈值一致，避免 UI 和时间线各判一套状态。 */
export function isTranscriptAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 2,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
}

/** 与 Markstream te（48px）一致：上翻解锁的 3px / DPI 余量仍算在底部，不弹出按钮。 */
export function isTranscriptVisuallyAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): boolean {
  return isTranscriptAtBottom(scrollHeight, scrollTop, clientHeight, 48)
}

/** 有内容且视觉上离开底部才显示回到底部按钮。 */
export function shouldShowScrollToLatest(transcriptLength: number, atBottom: boolean): boolean {
  return transcriptLength > 0 && !atBottom
}

/** 无助手正文即可撤；有则必须已挂上且 pending 清零。 */
export function isMarkdownStreamReady(
  hasMarkdownRows: boolean,
  pendingCount: number,
  mounted: boolean,
): boolean {
  if (pendingCount > 0) return false
  if (!hasMarkdownRows) return true
  return mounted
}

/** 盖过时间线已排队的旧锚点 rAF 与测高回写。 */
export const PROGRAMMATIC_BOTTOM_HOLD_MS = 400

/** 程序化滚底后，未贴底读数在 hold 窗口内视为旧锚点回写。 */
export function shouldHoldProgrammaticBottom(
  measuredBottom: boolean,
  holdUntil: number,
  now: number,
): boolean {
  return !measuredBottom && now < holdUntil
}

/** 贴底后明显上翻才解锁。1px 级惯性不能 preventDefault，否则永远触不了底。 */
export function unpinBottomScrollTop(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  deltaY: number,
  threshold = 2,
): number | null {
  if (deltaY >= 0 || Math.abs(deltaY) <= threshold) return null
  if (!isTranscriptAtBottom(scrollHeight, scrollTop, clientHeight, threshold)) return null
  const maxTop = Math.max(0, scrollHeight - clientHeight)
  return Math.max(0, Math.min(maxTop, scrollTop - Math.abs(deltaY)))
}
