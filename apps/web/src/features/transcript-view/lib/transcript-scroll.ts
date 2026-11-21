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

export const GLIDE_MAX_VIEWPORTS = 2.5
export const GLIDE_MAX_CATCHUP_FRAMES = 8

export function createGlideSpring() {
  let velocity = 0
  let targetVelocity = 0
  let lastTarget: number | null = null
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

export function isTranscriptVisuallyAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= 48
}

export function shouldShowScrollToLatest(transcriptLength: number, atBottom: boolean): boolean {
  return transcriptLength > 0 && !atBottom
}

export const FOLLOW_NEAR_BOTTOM_PX = 80

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
