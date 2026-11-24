import { describe, expect, it } from "vitest"
import { pinnedSlot, planDrop, sweepIds } from "@features/session-nav/lib/drag-plan.js"

describe("planDrop", () => {
  const pinnedOrder = ["a", "b", "c"]

  it("跨段落点决定动作：拖进置顶、拖出置顶、拖进/拖出已归档", () => {
    const base = { id: "x", pinnedOrder, slot: 1 }
    expect(planDrop({ ...base, from: "active", zone: "pinned" })).toEqual({ kind: "pin", slot: 1 })
    expect(planDrop({ ...base, from: "settled", zone: "pinned" })).toEqual({ kind: "pin", slot: 1 })
    expect(planDrop({ ...base, id: "a", from: "pinned", zone: "active" })).toEqual({
      kind: "unpin",
    })
    expect(planDrop({ ...base, from: "active", zone: "settled" })).toEqual({ kind: "settle" })
    expect(planDrop({ ...base, id: "a", from: "pinned", zone: "settled" })).toEqual({
      kind: "settle",
    })
    expect(planDrop({ ...base, from: "settled", zone: "active" })).toEqual({ kind: "unsettle" })
  })

  it("原地松手、工作中的行、段外松手什么都不做", () => {
    const base = { pinnedOrder, slot: 0 }
    expect(planDrop({ ...base, id: "a", from: "pinned", zone: "pinned", slot: 1 })).toEqual({
      kind: "none",
    })
    expect(planDrop({ ...base, id: "x", from: "active", zone: "active" })).toEqual({ kind: "none" })
    expect(planDrop({ ...base, id: "x", from: "working", zone: "pinned" })).toEqual({
      kind: "none",
    })
    expect(planDrop({ ...base, id: "x", from: "active", zone: null })).toEqual({ kind: "none" })
    expect(planDrop({ ...base, id: "c", from: "pinned", zone: "pinned", slot: 0 })).toEqual({
      kind: "reorder-pinned",
      slot: 0,
    })
  })
})

describe("pinnedSlot", () => {
  it("筛选后只看得到部分置顶行，空位仍换算到全表位置", () => {
    const order = ["a", "b", "c", "d"]
    expect(pinnedSlot(order, ["b", "d"], 0)).toBe(1)
    expect(pinnedSlot(order, ["b", "d"], 1)).toBe(3)
    expect(pinnedSlot(order, ["b", "d"], 2)).toBe(4)
    expect(pinnedSlot(order, [], 0)).toBe(0)
  })
})

describe("sweepIds", () => {
  it("上下扫都取起点到当前行之间，跳过不能处理的行", () => {
    const order = ["a", "b", "c", "d"]
    expect(sweepIds(order, "b", "d", () => true)).toEqual(["b", "c", "d"])
    expect(sweepIds(order, "c", "a", (id) => id !== "b")).toEqual(["a", "c"])
  })
})
