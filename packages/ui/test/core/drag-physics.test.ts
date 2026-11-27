import { describe, expect, it } from "vitest"
import {
  computeClosedMetrics,
  computeItemMotions,
  computeLiftOffset,
  computeLinePosition,
  findDropGap,
  isPointOutsideRect,
  moveKeyInOrder,
  POINTER_SPRING,
  RIPPLE_AMPLITUDE,
  SETTLE_SPRING,
  stepSpring,
  type AxisRect,
} from "../../src/core/drag-physics.js"

function verticalRects(count: number, size = 40, gap = 8): AxisRect[] {
  return Array.from({ length: count }, (_, i) => ({
    start: i * (size + gap),
    size,
    crossStart: 0,
    crossSize: 200,
  }))
}

describe("computeClosedMetrics", () => {
  it("合拢被抓起条目的旧槽位，后续条目左移/上移一个步距", () => {
    const rects = verticalRects(4, 40, 8)
    const closed = computeClosedMetrics(rects, 1)

    expect(closed.stride).toBe(48)
    expect(closed.interGap).toBe(8)
    expect(closed.remainingIndices).toEqual([0, 2, 3])
    expect(closed.remaining.map((r) => r.start)).toEqual([0, 48, 96])
  })

  it("RTL 水平列表合拢旧槽位时后续条目向右补位", () => {
    const rtlRects: AxisRect[] = [
      { start: 220, size: 80, crossStart: 0, crossSize: 32 },
      { start: 110, size: 100, crossStart: 0, crossSize: 32 },
      { start: 10, size: 90, crossStart: 0, crossSize: 32 },
    ]
    const closed = computeClosedMetrics(rtlRects, 0, true)

    expect(closed.interGap).toBe(10)
    expect(closed.stride).toBe(90)
    expect(closed.remaining.map((r) => r.start)).toEqual([200, 100])
  })

  it("跨列表（dragIndex = -1）不收缩任何槽位", () => {
    const rects = verticalRects(3, 40, 8)
    const closed = computeClosedMetrics(rects, -1)

    expect(closed.stride).toBe(0)
    expect(closed.remaining.map((r) => r.start)).toEqual([0, 48, 96])
  })
})

describe("computeItemMotions", () => {
  it("落在原槽位（gap === dragIndex）时不产生波纹与延迟", () => {
    const motions = computeItemMotions(4, 1, 48, 1, {
      amplitude: RIPPLE_AMPLITUDE.card,
      reducedMotion: false,
    })

    expect(motions).toEqual([
      { shift: 0, delayMs: 0 },
      { shift: 0, delayMs: 0 },
      { shift: -48, delayMs: 0 },
      { shift: -48, delayMs: 0 },
    ])
  })

  it("激活空位时两侧按 A * 0.7^n 向外让开，且每格延迟 24ms * n", () => {
    const motions = computeItemMotions(5, 4, 48, 2, {
      amplitude: RIPPLE_AMPLITUDE.card,
      reducedMotion: false,
    })

    expect(motions[0]).toEqual({ shift: -(8 * 0.7), delayMs: 24 })
    expect(motions[1]).toEqual({ shift: -8, delayMs: 0 })
    expect(motions[2]).toEqual({ shift: 8, delayMs: 0 })
    expect(motions[3]).toEqual({ shift: 8 * 0.7, delayMs: 24 })
    expect(motions[4]).toEqual({ shift: 0, delayMs: 0 })

    const iconMotions = computeItemMotions(3, -1, 0, 1, {
      amplitude: RIPPLE_AMPLITUDE.icon,
      reducedMotion: false,
    })

    expect(iconMotions).toEqual([
      { shift: -10, delayMs: 0 },
      { shift: 10, delayMs: 0 },
      { shift: 7, delayMs: 24 },
    ])
  })

  it("RTL 水平行反转波纹推开方向与命中空位顺序", () => {
    const rtlRects: AxisRect[] = [
      { start: 220, size: 80, crossStart: 0, crossSize: 32 },
      { start: 120, size: 80, crossStart: 0, crossSize: 32 },
      { start: 20, size: 80, crossStart: 0, crossSize: 32 },
    ]

    expect(findDropGap(rtlRects, 280, true)).toBe(0)
    expect(findDropGap(rtlRects, 180, true)).toBe(1)
    expect(findDropGap(rtlRects, 80, true)).toBe(2)
    expect(findDropGap(rtlRects, 10, true)).toBe(3)

    const motions = computeItemMotions(3, -1, 0, 1, {
      amplitude: RIPPLE_AMPLITUDE.icon,
      reducedMotion: false,
      reversed: true,
    })

    expect(motions).toEqual([
      { shift: 10, delayMs: 0 },
      { shift: -10, delayMs: 0 },
      { shift: -7, delayMs: 24 },
    ])
  })

  it("减弱动效模式清空所有位移动画与延迟", () => {
    const motions = computeItemMotions(4, 1, 48, 3, {
      amplitude: RIPPLE_AMPLITUDE.card,
      reducedMotion: true,
    })

    expect(motions).toEqual([
      { shift: 0, delayMs: 0 },
      { shift: 0, delayMs: 0 },
      { shift: 0, delayMs: 0 },
      { shift: 0, delayMs: 0 },
    ])
  })
})

describe("computeLinePosition", () => {
  it("计算起止、中间及空容器提示线坐标并保留两端内缩", () => {
    const rects = verticalRects(2, 40, 8)

    expect(computeLinePosition(rects, 0, 8)).toEqual({ axis: -4, crossStart: 8, crossSize: 184 })
    expect(computeLinePosition(rects, 1, 8)).toEqual({ axis: 44, crossStart: 8, crossSize: 184 })
    expect(computeLinePosition(rects, 2, 8)).toEqual({ axis: 92, crossStart: 8, crossSize: 184 })
    expect(
      computeLinePosition([], 0, 0, { start: 0, size: 36, crossStart: 0, crossSize: 200 }),
    ).toEqual({ axis: 18, crossStart: 8, crossSize: 184 })
    expect(computeLinePosition([], 0, 0)).toBeNull()
  })
})

describe("computeLiftOffset", () => {
  it("水平行抬起在行上方；垂直列表侧移并缩放到 0.9", () => {
    expect(computeLiftOffset("horizontal", { width: 120, height: 24 }, "end")).toEqual({
      x: 0,
      y: -(24 * 0.6 + 10),
      scale: 1.03,
    })
    expect(computeLiftOffset("vertical", { width: 200, height: 48 }, "end")).toEqual({
      x: 20,
      y: 0,
      scale: 0.9,
    })
    expect(computeLiftOffset("vertical", { width: 200, height: 48 }, "start")).toEqual({
      x: -20,
      y: 0,
      scale: 0.9,
    })
    expect(computeLiftOffset("vertical", { width: 200, height: 48 }, "start", true)).toEqual({
      x: 20,
      y: 0,
      scale: 0.9,
    })
  })
})

describe("stepSpring", () => {
  it("SETTLE_SPRING 在约 0.25s 内落定且仅有极轻微过冲", () => {
    const axis = { value: 0, velocity: 0 }
    let peak = 0
    let settledAt = -1

    for (let step = 1; step <= 30; step += 1) {
      const done = stepSpring(axis, 100, SETTLE_SPRING, 1 / 60)

      if (axis.value > peak) peak = axis.value

      if (done && settledAt < 0) {
        settledAt = step / 60
        break
      }
    }

    expect(peak).toBeGreaterThan(100.5)
    expect(peak).toBeLessThan(104)
    expect(settledAt).toBeGreaterThan(0.12)
    expect(settledAt).toBeLessThanOrEqual(0.3)
  })

  it("POINTER_SPRING 紧跟指针且不过冲", () => {
    const axis = { value: 0, velocity: 0 }
    let peak = 0

    for (let step = 1; step <= 20; step += 1) {
      const done = stepSpring(axis, 100, POINTER_SPRING, 1 / 60)

      if (axis.value > peak) peak = axis.value

      if (done) break
    }

    expect(peak).toBeLessThanOrEqual(100.1)
    expect(axis.value).toBe(100)
  })
})

describe("isPointOutsideRect & moveKeyInOrder", () => {
  it("带容差判断指针是否移出容器边界", () => {
    const rect = { left: 100, top: 100, right: 300, bottom: 300 }

    expect(isPointOutsideRect({ x: 320, y: 200 }, rect, 24)).toBe(false)
    expect(isPointOutsideRect({ x: 325, y: 200 }, rect, 24)).toBe(true)
    expect(isPointOutsideRect({ x: 100, y: 70 }, rect, 0, 24)).toBe(true)
  })

  it("按当前挂载项空位换算全表新顺序，支持折叠列表", () => {
    const order = ["a", "b", "c", "d"]

    expect(moveKeyInOrder(order, order, "c", 0)).toEqual(["c", "a", "b", "d"])
    expect(moveKeyInOrder(order, ["a", "b"], "a", 1)).toEqual(["b", "a", "c", "d"])
    expect(moveKeyInOrder(order, ["a", "b"], "b", 1)).toBe(order)
  })
})
