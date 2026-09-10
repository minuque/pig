/** 精确贴底：2px 内视为贴底。 */
export function isTranscriptAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 2,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
}

export function transcriptFloorTop(scrollHeight: number, clientHeight: number): number {
  return Math.max(0, scrollHeight - clientHeight)
}

/** 视觉贴底：48px 内仍算在底部，不弹出回底部按钮。 */
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

/** 已离开底部且靠近顶部时，上翻再拉更早一页。 */
export function shouldLoadOlderTranscript(
  hasMore: boolean,
  loading: boolean,
  atBottom: boolean,
  scrollTop: number,
  threshold = 48,
): boolean {
  return hasMore && !loading && !atBottom && scrollTop <= threshold
}

/** 上方插入内容后把 scrollTop 加上增高，视口里的字不动。 */
export function restoreScrollAfterPrepend(
  root: { scrollTop: number; scrollHeight: number },
  beforeHeight: number,
  beforeTop: number,
): void {
  const delta = root.scrollHeight - beforeHeight
  if (delta === 0) return
  root.scrollTop = beforeTop + delta
}
