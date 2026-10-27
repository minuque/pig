import { describe, expect, it } from "vitest"
import {
  arrivalProgress,
  buildRailPaths,
  connectorParts,
  STEP_REVEAL_MS,
} from "@features/transcript-view/lib/step-rail.js"

describe("connectorParts", () => {
  it("起点两段都未开始，终点都到满", () => {
    expect(connectorParts(0, false)).toEqual({ incoming: 0, branch: 0 })
    expect(connectorParts(1, true)).toEqual({ incoming: 1, branch: 1 })
  })

  it("首行主干先到，有前序时枝更晚起", () => {
    // 无前序：主干在 0.62 前走完；有前序：0.72 才走完，0.65 仍是 0.9
    expect(connectorParts(0.65, false).incoming).toBe(1)
    // 枝的起点 0.68，0.65 还没开始长
    expect(connectorParts(0.65, true).branch).toBe(0)
  })
})

describe("arrivalProgress", () => {
  it("历史步骤直接到位", () => {
    expect(arrivalProgress(undefined, 1000)).toBe(1)
  })

  it("从 0 渐到 1，超时后停在 1", () => {
    expect(arrivalProgress(1000, 1000)).toBe(0)
    expect(arrivalProgress(1000, 1000 + STEP_REVEAL_MS / 2)).toBeGreaterThan(0)
    expect(arrivalProgress(1000, 1000 + STEP_REVEAL_MS * 3)).toBe(1)
  })
})

describe("buildRailPaths", () => {
  it("全部就位时合成一条 path，末行止于 bend", () => {
    const paths = buildRailPaths({ centers: [10, 40], progress: [1, 1] })

    expect(paths).toHaveLength(1)
    expect(paths[0]?.d).toContain("V 34")
    expect(paths[0]).not.toHaveProperty("stroke-dasharray")
  })

  it("正在长出的枝单独一条，带 dash 与透明度", () => {
    const paths = buildRailPaths({ centers: [10, 40], progress: [1, 0.7] })
    const growing = paths.at(-1)

    expect(paths).toHaveLength(2)
    expect(growing?.opacity).toBeGreaterThan(0)
    expect(growing).toHaveProperty("stroke-dasharray")
  })

  it("没有步骤时不出 path", () => {
    expect(buildRailPaths({ centers: [], progress: [] })).toEqual([])
  })
})
