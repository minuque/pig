import { describe, expect, it } from "vitest"
import {
  dropVerb,
  pinnedSlot,
  planDrop,
  projectOffsets,
  sortedSlot,
  sweepIds,
} from "@features/session-nav/lib/drag-plan.js"

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

  it("落点动作提示只在换段时出现", () => {
    expect(dropVerb("active", "pinned")).toBe("pin")
    expect(dropVerb("pinned", "active")).toBe("unpin")
    expect(dropVerb("settled", "active")).toBe("unsettle")
    expect(dropVerb("pinned", "settled")).toBe("settle")
    expect(dropVerb("pinned", "pinned")).toBeNull()
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

describe("projectOffsets", () => {
  const items = [
    { key: "head", kind: "label" as const },
    { key: "p1", kind: "row" as const },
    { key: "divider", kind: "label" as const },
    { key: "a1", kind: "row" as const },
    { key: "a2", kind: "row" as const },
    { key: "a3", kind: "row" as const },
  ]

  it("被拖行抽走后下面的行补位，落点处空出一格，段名撑开", () => {
    const offsets = projectOffsets({
      items,
      activeKey: "a2",
      insertAfter: "p1",
      size: 60,
      label: 24,
    })

    expect(offsets.get("head")).toBe(0)
    expect(offsets.get("p1")).toBe(24)
    expect(offsets.get("divider")).toBe(84)
    expect(offsets.get("a1")).toBe(108)
    expect(offsets.has("a2")).toBe(false)
    expect(offsets.get("a3")).toBe(48)
  })

  it("没有落点时只合拢原位", () => {
    const offsets = projectOffsets({ items, activeKey: "a1", size: 60, label: 0 })
    expect(offsets.get("a2")).toBe(-60)
    expect(offsets.get("p1")).toBe(0)
  })
})

describe("sortedSlot", () => {
  it("按排序键找回时间序里的位置", () => {
    const rows = [
      { id: "a", sortKey: 30 },
      { id: "b", sortKey: 20 },
      { id: "c", sortKey: 10 },
    ]

    expect(sortedSlot(rows, { id: "x", sortKey: 25 })).toBe(1)
    expect(sortedSlot(rows, { id: "x", sortKey: 40 })).toBe(0)
    expect(sortedSlot(rows, { id: "x", sortKey: 1 })).toBe(3)
  })
})

describe("sweepIds", () => {
  it("上下扫都取起点到当前行之间，跳过不能处理的行", () => {
    const order = ["a", "b", "c", "d"]
    expect(sweepIds(order, "b", "d", () => true)).toEqual(["b", "c", "d"])
    expect(sweepIds(order, "c", "a", (id) => id !== "b")).toEqual(["a", "c"])
  })
})
