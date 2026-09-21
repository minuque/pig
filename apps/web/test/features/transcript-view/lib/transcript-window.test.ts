import { describe, expect, it } from "vitest"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  buildWindowBlocks,
  estimateRowHeight,
  mergeMountedIndices,
  resolveVisibleRange,
  TranscriptHeightIndex,
  WINDOW_MIN_BUFFER,
} from "@features/transcript-view/lib/transcript-window.js"

function dense(count: number, height: number): TranscriptHeightIndex {
  return new TranscriptHeightIndex(Array.from({ length: count }, () => height))
}

function row(id: string): TimelineRow {
  return {
    id,
    role: "assistant",
    text: "答",
    streaming: false,
    error: false,
    aborted: false,
    timestamp: 0,
  }
}

describe("打开已有会话 → 长列表按视口窗口挂载", () => {
  it("高度索引的空表与越界取值", () => {
    const empty = new TranscriptHeightIndex()

    expect(empty.length).toBe(0)
    expect(empty.total).toBe(0)
    expect(empty.top(3)).toBe(0)
    expect(empty.at(10)).toBe(-1)
    expect(empty.apply(0, 100, true)).toBe(false)
  })

  it("reset 建表后 top 是前缀和、at 反查下标", () => {
    const index = new TranscriptHeightIndex([100, 200, 300])

    expect(index.length).toBe(3)
    expect(index.total).toBe(600)
    expect(index.top(0)).toBe(0)
    expect(index.top(1)).toBe(100)
    expect(index.top(3)).toBe(600)
    expect(index.top(9)).toBe(600)
    expect(index.top(-2)).toBe(0)
    expect(index.size(1)).toBe(200)
    expect(index.at(0)).toBe(0)
    expect(index.at(99)).toBe(0)
    expect(index.at(100)).toBe(1)
    expect(index.at(299)).toBe(1)
    expect(index.at(300)).toBe(2)
    expect(index.at(599)).toBe(2)
    expect(index.at(600)).toBe(2)
    expect(index.at(-10)).toBe(0)
  })

  it("实测值永久生效，估算只覆盖没实测过的行", () => {
    const index = new TranscriptHeightIndex([100, 200, 300])

    expect(index.apply(1, 260, true)).toBe(true)
    expect(index.total).toBe(660)
    expect(index.top(2)).toBe(360)
    expect(index.isMeasured(1)).toBe(true)
    expect(index.apply(1, 400, false)).toBe(false)
    expect(index.size(1)).toBe(260)
    expect(index.apply(0, 140, false)).toBe(true)
    expect(index.size(0)).toBe(140)
    expect(index.apply(9, 140, true)).toBe(false)
  })

  it("实测回写有 0.25px 死区，估算没有", () => {
    const index = new TranscriptHeightIndex([100])

    expect(index.apply(0, 100.1, true)).toBe(false)
    expect(index.apply(0, 100.1, false)).toBe(true)
    expect(index.size(0)).toBe(100.1)
    expect(index.apply(0, 100.3, true)).toBe(false)
    expect(index.apply(0, 100.5, true)).toBe(true)
    expect(index.size(0)).toBe(100.5)
  })

  it("窗口范围带 400px 下限，并入常驻行后钳到两端", () => {
    const index = dense(10, 100)
    const range = resolveVisibleRange({
      length: 10,
      scrollTop: 1000,
      viewportHeight: 100,
      at: (offset) => index.at(offset),
    })

    expect(WINDOW_MIN_BUFFER).toBe(400)
    expect(range).toEqual({ start: 6, end: 9 })
  })

  it("视口高于下限时按视口倍数放大缓冲", () => {
    const index = dense(20, 100)
    const range = resolveVisibleRange({
      length: 20,
      scrollTop: 1000,
      viewportHeight: 1000,
      at: (offset) => index.at(offset),
    })

    expect(range).toEqual({ start: 0, end: 19 })
  })

  it("尾部常驻和选区行并入挂载下标，去重升序并钳在范围内", () => {
    expect(mergeMountedIndices({ start: 4, end: 6 }, [6, 19, 4, -1, 99], 20)).toEqual([4, 5, 6, 19])
    expect(mergeMountedIndices({ start: 0, end: -1 }, [19], 20)).toEqual([19])
    expect(mergeMountedIndices({ start: 0, end: 2 }, [], 2)).toEqual([0, 1])
    expect(
      resolveVisibleRange({ length: 0, scrollTop: 0, viewportHeight: 0, at: () => -1 }),
    ).toEqual({ start: 0, end: -1 })
  })

  it("空档用 space 补，首尾也补，行块连号", () => {
    const index = dense(5, 100)
    const rows = ["a", "b", "c", "d", "e"].map(row)
    const blocks = buildWindowBlocks(rows, [1, 2, 3], (at) => index.top(at), index.total)

    expect(blocks).toEqual([
      { kind: "space", key: "space:head", height: 100 },
      { kind: "row", key: "b", row: rows[1], index: 1 },
      { kind: "row", key: "c", row: rows[2], index: 2 },
      { kind: "row", key: "d", row: rows[3], index: 3 },
      { kind: "space", key: "space:tail", height: 100 },
    ])
    expect(
      buildWindowBlocks(rows, [0, 1, 2, 3, 4], (at) => index.top(at), index.total).every(
        (block) => block.kind === "row",
      ),
    ).toBe(true)
    expect(buildWindowBlocks([], [], () => 0, 0)).toEqual([])
  })

  it("尾部常驻行视口外单独挂载，中间空档留 space", () => {
    const index = dense(20, 100)
    const rows = Array.from({ length: 20 }, (_, at) => row(`r${at}`))
    const visible = resolveVisibleRange({
      length: 20,
      scrollTop: 0,
      viewportHeight: 100,
      at: (offset) => index.at(offset),
    })
    const mounted = new Set<number>([19])

    for (let at = visible.start; at <= visible.end; at += 1) mounted.add(at)

    const blocks = buildWindowBlocks(
      rows,
      [...mounted].sort((left, right) => left - right),
      (at) => index.top(at),
      index.total,
    )
    const kinds = blocks.map((block) => block.kind)

    expect(visible).toEqual({ start: 0, end: 5 })
    expect(kinds).toEqual(["row", "row", "row", "row", "row", "row", "space", "row"])
    expect(blocks.at(-1)).toMatchObject({ kind: "row", index: 19 })
    expect(blocks.at(-2)).toMatchObject({ kind: "space", height: 1300 })
  })

  it("行高估算按角色分档且都为正", () => {
    const values = [
      estimateRowHeight("user"),
      estimateRowHeight("assistant"),
      estimateRowHeight("tools"),
    ]

    expect(values.every((value) => value > 0)).toBe(true)
    expect(new Set(values).size).toBe(3)
  })
})
