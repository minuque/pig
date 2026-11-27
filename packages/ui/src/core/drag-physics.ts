export type DragOrientation = "vertical" | "horizontal"

export type DragItemDensity = "card" | "icon"

export type DragLiftSide = "start" | "end"

export interface AxisRect {
  start: number
  size: number
  crossStart: number
  crossSize: number
}

export interface LineRect {
  axis: number
  crossStart: number
  crossSize: number
}

export interface SpringParams {
  stiffness: number
  damping: number
}

export interface SpringAxis {
  value: number
  velocity: number
}

export interface ItemMotion {
  shift: number
  delayMs: number
}

export interface ClosedMetrics {
  stride: number
  interGap: number
  remaining: AxisRect[]
  remainingIndices: number[]
}

export const RIPPLE_DECAY = 0.7
export const RIPPLE_STAGGER_MS = 24
export const RIPPLE_AMPLITUDE = { card: 8, icon: 10 } as const
export const RIPPLE_EPSILON_PX = 0.1
export const VERTICAL_LIFT_SCALE = 0.9
export const VERTICAL_LIFT_ASIDE_PX = 20
export const HORIZONTAL_LIFT_CLEARANCE_PX = 10
export const OUTSIDE_SLOP_PX = 24
export const POINTER_SPRING: SpringParams = { stiffness: 2400, damping: 98 }
export const LIFT_POP_SPRING: SpringParams = { stiffness: 520, damping: 24 }
export const SETTLE_SPRING: SpringParams = { stiffness: 1350, damping: 57 }

export function stepSpring(
  axis: SpringAxis,
  target: number,
  params: SpringParams,
  dtSeconds: number,
): boolean {
  const dt = Math.min(Math.max(dtSeconds, 0), 0.032)
  const steps = Math.max(1, Math.ceil(dt / 0.004))
  const h = dt / steps

  for (let i = 0; i < steps; i += 1) {
    const acc = -params.stiffness * (axis.value - target) - params.damping * axis.velocity
    axis.velocity += acc * h
    axis.value += axis.velocity * h
  }

  if (Math.abs(target - axis.value) < 0.08 && Math.abs(axis.velocity) < 0.5) {
    axis.value = target
    axis.velocity = 0
    return true
  }

  return false
}

export function computeClosedMetrics(
  rects: readonly AxisRect[],
  dragIndex: number,
  reversed = false,
): ClosedMetrics {
  const first = rects[0]
  const second = rects[1]
  const interGap =
    first && second
      ? Math.max(
          0,
          reversed
            ? first.start - (second.start + second.size)
            : second.start - (first.start + first.size),
        )
      : 0

  let stride = 0
  const dragged = dragIndex >= 0 ? rects[dragIndex] : undefined

  if (dragged) {
    const next = rects[dragIndex + 1]
    const prev = dragIndex > 0 ? rects[dragIndex - 1] : undefined

    if (next) {
      stride = Math.max(
        0,
        reversed
          ? dragged.start + dragged.size - (next.start + next.size)
          : next.start - dragged.start,
      )
    } else if (prev) {
      stride = Math.max(
        0,
        reversed
          ? prev.start - dragged.start
          : dragged.start + dragged.size - (prev.start + prev.size),
      )
    } else {
      stride = dragged.size
    }
  }

  const remaining: AxisRect[] = []
  const remainingIndices: number[] = []

  for (let i = 0; i < rects.length; i += 1) {
    if (i === dragIndex) continue
    const rect = rects[i]!
    const closeShift = dragIndex >= 0 && i > dragIndex ? (reversed ? stride : -stride) : 0
    remaining.push({
      start: rect.start + closeShift,
      size: rect.size,
      crossStart: rect.crossStart,
      crossSize: rect.crossSize,
    })
    remainingIndices.push(i)
  }

  return { stride, interGap, remaining, remainingIndices }
}

export function findDropGap(
  remaining: readonly AxisRect[],
  pointerAxis: number,
  reversed = false,
): number {
  let index = 0

  for (const rect of remaining) {
    const middle = rect.start + rect.size / 2

    if (reversed ? middle > pointerAxis : middle < pointerAxis) index += 1
  }

  return index
}

export function computeLinePosition(
  remaining: readonly AxisRect[],
  gap: number,
  interGap: number,
  containerRect?: AxisRect,
  reversed = false,
): LineRect | null {
  if (remaining.length === 0) {
    if (!containerRect || containerRect.size <= 0) return null
    const inset = Math.min(8, Math.max(0, (containerRect.crossSize - 24) / 2))
    return {
      axis: containerRect.start + containerRect.size / 2,
      crossStart: containerRect.crossStart + inset,
      crossSize: Math.max(0, containerRect.crossSize - inset * 2),
    }
  }

  let minCross = Infinity
  let maxCross = -Infinity

  for (const rect of remaining) {
    if (rect.crossStart < minCross) minCross = rect.crossStart

    if (rect.crossStart + rect.crossSize > maxCross) maxCross = rect.crossStart + rect.crossSize
  }

  const crossSpan = Math.max(0, maxCross - minCross)
  const inset = Math.min(8, Math.max(0, (crossSpan - 24) / 2))
  const first = remaining[0]!
  const last = remaining[remaining.length - 1]!
  let axis: number

  if (gap <= 0) {
    axis = reversed ? first.start + first.size + interGap / 2 : first.start - interGap / 2
  } else if (gap >= remaining.length) {
    axis = reversed ? last.start - interGap / 2 : last.start + last.size + interGap / 2
  } else {
    const before = remaining[gap - 1]!
    const after = remaining[gap]!
    axis = reversed
      ? (before.start + after.start + after.size) / 2
      : (before.start + before.size + after.start) / 2
  }

  return {
    axis,
    crossStart: minCross + inset,
    crossSize: Math.max(0, crossSpan - inset * 2),
  }
}

export function computeItemMotions(
  count: number,
  dragIndex: number,
  stride: number,
  gap: number | null,
  options: { amplitude: number; reducedMotion: boolean; reversed?: boolean },
): ItemMotion[] {
  const reversed = options.reversed ?? false
  const motions: ItemMotion[] = []

  for (let i = 0; i < count; i += 1) {
    if (i === dragIndex || options.reducedMotion) {
      motions.push({ shift: 0, delayMs: 0 })
      continue
    }

    const closeShift = dragIndex >= 0 && i > dragIndex ? (reversed ? stride : -stride) : 0

    if (gap === null || (dragIndex >= 0 && gap === dragIndex)) {
      motions.push({ shift: closeShift, delayMs: 0 })
      continue
    }

    const r = dragIndex >= 0 && i > dragIndex ? i - 1 : i
    const isBefore = r < gap
    const n = isBefore ? gap - 1 - r : r - gap
    const dir = isBefore ? (reversed ? 1 : -1) : reversed ? -1 : 1
    const mag = options.amplitude * Math.pow(RIPPLE_DECAY, n)
    const ripple = mag < RIPPLE_EPSILON_PX ? 0 : dir * mag
    const delayMs = ripple === 0 ? 0 : RIPPLE_STAGGER_MS * n

    motions.push({ shift: closeShift + ripple, delayMs })
  }

  return motions
}

export function computeLiftOffset(
  orientation: DragOrientation,
  size: { width: number; height: number },
  liftSide: DragLiftSide,
  rtl = false,
): { x: number; y: number; scale: number } {
  if (orientation === "horizontal") {
    return {
      x: 0,
      y: -(size.height * 0.6 + HORIZONTAL_LIFT_CLEARANCE_PX),
      scale: 1.03,
    }
  }

  const sign = (liftSide === "start" ? -1 : 1) * (rtl ? -1 : 1)
  return {
    x: sign * VERTICAL_LIFT_ASIDE_PX,
    y: 0,
    scale: VERTICAL_LIFT_SCALE,
  }
}

export function isPointOutsideRect(
  point: { x: number; y: number },
  rect: { left: number; top: number; right: number; bottom: number },
  slopX = OUTSIDE_SLOP_PX,
  slopY = slopX,
): boolean {
  return (
    point.x < rect.left - slopX ||
    point.x > rect.right + slopX ||
    point.y < rect.top - slopY ||
    point.y > rect.bottom + slopY
  )
}

export function moveKeyInOrder(
  order: readonly string[],
  mounted: readonly string[],
  key: string,
  targetGap: number,
): string[] {
  if (!order.includes(key)) return [...order]

  const restMounted = mounted.filter((item) => item !== key)
  const restFull = order.filter((item) => item !== key)
  const clamped = Math.max(0, Math.min(restMounted.length, targetGap))
  let insertAt = 0

  if (clamped < restMounted.length) {
    const anchor = restMounted[clamped]!
    const idx = restFull.indexOf(anchor)
    insertAt = idx >= 0 ? idx : restFull.length
  } else if (restMounted.length > 0) {
    const anchor = restMounted[restMounted.length - 1]!
    const idx = restFull.indexOf(anchor)
    insertAt = idx >= 0 ? idx + 1 : restFull.length
  }

  restFull.splice(insertAt, 0, key)

  if (restFull.length === order.length && restFull.every((item, idx) => item === order[idx])) {
    return order as string[]
  }

  return restFull
}
