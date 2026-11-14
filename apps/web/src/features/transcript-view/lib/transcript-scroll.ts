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

export function transcriptFloorTop(scrollHeight: number, clientHeight: number): number {
  return Math.max(0, scrollHeight - clientHeight)
}

/** 回底滑动离底超过这么多屏时先瞬移到这里，只滑最后一段。 */
export const GLIDE_MAX_VIEWPORTS = 2.5
/** 一帧最多补算的 60fps 帧数：卡顿后追赶，不瞬移。 */
export const GLIDE_MAX_CATCHUP_FRAMES = 8

/**
 * 回底弹簧（与 zeron 的 StickSpring 同参）：每帧重读目标，按速度逼近，
 * 目标在途中变高时用增长估计前馈追上；不越过目标，0.5px 内落定。
 */
export function createGlideSpring() {
  let velocity = 0
  let targetVelocity = 0
  let lastTarget: number | null = null
  /** pos/target 是 scrollTop，frames 是经过的 60fps 帧数。 */
  return function step(pos: number, target: number, frames: number): number {
    const grew = lastTarget === null ? 0 : target - lastTarget
    lastTarget = target

    if (grew < -1) targetVelocity = 0
    else targetVelocity += 0.12 * (Math.max(0, grew) / Math.max(0.25, frames) - targetVelocity)

    const chase = target - Math.min(targetVelocity * 9, 32)
    let left = frames

    while (left > 0) {
      const h = Math.min(1, left)
      left -= h
      velocity += h * ((0.7 * velocity + 0.05 * Math.max(0, chase - pos)) / 1.25 - velocity)
      pos = Math.min(target, pos + (velocity + targetVelocity) * h)
    }

    return target - pos <= 0.5 ? target : pos
  }
}

/** 视觉贴底：48px 内仍算在底部，不弹出回底部按钮。 */
export function isTranscriptVisuallyAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= 48
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
