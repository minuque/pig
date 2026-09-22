/** 收起后把按钮留在点击时的视口位置，直到高度动画结束。 */
export function holdClickedOffset(el: HTMLElement): void {
  const scroller = el.closest("#transcript-panel")
  const box = el.parentElement

  if (!(scroller instanceof HTMLElement) || !box) return
  const target = el.getBoundingClientRect().top
  const observer = new ResizeObserver(() => {
    scroller.scrollTop += el.getBoundingClientRect().top - target
  })

  observer.observe(box)
  window.setTimeout(() => observer.disconnect(), 400)
}

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

/** 距底 80px 内且继续下滚才重新吸附。 */
export const FOLLOW_NEAR_BOTTOM_PX = 80

/** 脱底/吸附滞回：离底超过半屏才脱底，中间不翻转。 */
export function resolveFollowTarget(input: {
  atBottom: boolean
  distanceFromBottom: number
  viewportHeight: number
  scrollingDown: boolean
}): boolean {
  const far = Math.max(FOLLOW_NEAR_BOTTOM_PX, input.viewportHeight / 2)

  if (input.atBottom) return input.distanceFromBottom <= far
  return input.distanceFromBottom <= FOLLOW_NEAR_BOTTOM_PX && input.scrollingDown
}

export function transcriptOverflows(
  scrollHeight: number,
  clientHeight: number,
  threshold = 48,
): boolean {
  return scrollHeight - clientHeight > threshold
}

/** 已离开底部、列表溢出且靠近顶部时，上翻再拉更早一页。 */
export function shouldLoadOlderTranscript(
  hasMore: boolean,
  loading: boolean,
  atBottom: boolean,
  scrollTop: number,
  options: { threshold?: number; overflow?: boolean } = {},
): boolean {
  const threshold = options.threshold ?? 48
  const overflow = options.overflow ?? true
  return hasMore && !loading && !atBottom && overflow && scrollTop <= threshold
}

/** 更长列表的前缀是新历史，prev 仍作为后缀出现。 */
export function historyPrepended(
  prev: readonly { readonly id: string }[],
  next: readonly { readonly id: string }[],
): boolean {
  if (prev.length === 0 || next.length <= prev.length) return false
  const offset = next.length - prev.length

  for (let i = 0; i < prev.length; i += 1) {
    if (next[offset + i]?.id !== prev[i]?.id) return false
  }

  return true
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
