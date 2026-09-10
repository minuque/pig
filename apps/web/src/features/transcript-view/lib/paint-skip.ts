export const PAINT_SKIP_SETTLE_MS = 120
export const PAINT_SKIP_MAX_MS = 360

/** 距 arm 已过 elapsedMs 后再等多久；超过上限立即揭开。 */
export function paintSkipWaitMs(
  elapsedMs: number,
  settleMs = PAINT_SKIP_SETTLE_MS,
  maxMs = PAINT_SKIP_MAX_MS,
): number {
  if (elapsedMs >= maxMs) return 0
  return Math.min(settleMs, maxMs - elapsedMs)
}
