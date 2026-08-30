/** 精确贴底：2px 内视为贴底。 */
export function isTranscriptAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 2,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
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

/** 程序化滚底后短 hold，避免布局未完成时取消贴底。 */
export const PROGRAMMATIC_BOTTOM_HOLD_MS = 400

/** 用户平滑滚动未结束前，禁止瞬间贴底打断。 */
export const USER_SMOOTH_SCROLL_MS = 500

export function transcriptUserScrollBehavior(reduceMotion: boolean): ScrollBehavior {
  return reduceMotion ? "auto" : "smooth"
}

/** 程序化滚底后，未贴底读数在 hold 窗口内视为旧布局回写。 */
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
