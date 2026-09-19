/** 视口 column-reverse：scrollTop 0 是最新（底）。 */
export function isTranscriptAtBottom(
  _scrollHeight: number,
  scrollTop: number,
  _clientHeight: number,
  threshold = 2,
): boolean {
  return scrollTop <= threshold
}

export function transcriptFloorTop(_scrollHeight: number, _clientHeight: number): number {
  return 0
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

export function transcriptOverflows(
  scrollHeight: number,
  clientHeight: number,
  threshold = 48,
): boolean {
  return scrollHeight - clientHeight > threshold
}

/** 已离开底部、列表溢出且靠近顶部（scrollTop 最大）时，上翻再拉更早一页。 */
export function shouldLoadOlderTranscript(
  hasMore: boolean,
  loading: boolean,
  atBottom: boolean,
  scrollTop: number,
  options: {
    threshold?: number
    overflow?: boolean
    scrollHeight?: number
    clientHeight?: number
  } = {},
): boolean {
  const threshold = options.threshold ?? 48
  const overflow = options.overflow ?? true
  const max = Math.max(0, (options.scrollHeight ?? 0) - (options.clientHeight ?? 0))
  const atTop = max === 0 ? false : scrollTop >= max - threshold
  return hasMore && !loading && !atBottom && overflow && atTop
}

/** 底锚时增高发生在顶，视口不用补 delta。 */
export function restoreScrollAfterPrepend(
  _root: { scrollTop: number; scrollHeight: number },
  _beforeHeight: number,
  _beforeTop: number,
): void {}
