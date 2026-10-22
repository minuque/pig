import { describe, expect, it } from "vitest"
import {
  contextUsageSummary,
  formatTokenCount,
  projectContextUsage,
  segmentShare,
} from "@features/composer/lib/context-usage.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"

const estimate: ContextUsageEstimate = {
  used: 1500,
  window: 10_000,
  segments: {
    systemPrompt: 100,
    memory: 0,
    skills: 20,
    tools: 300,
    toolResults: 400,
    conversation: 680,
    other: 0,
    idle: 0,
  },
}

describe("projectContextUsage", () => {
  it("无估算返回 undefined，占比按窗口钳到 0–100", () => {
    expect(projectContextUsage(undefined)).toBeUndefined()
    expect(projectContextUsage({ ...estimate, used: 20_000 })?.percent).toBe(100)
    expect(projectContextUsage({ ...estimate, window: 0 })?.percent).toBe(0)
    expect(projectContextUsage({ ...estimate, used: -5 })).toMatchObject({ used: 0, percent: 0 })
    expect(projectContextUsage(estimate)?.percent).toBe(15)
  })

  it("八段按固定顺序投影，缺字段补 0，other/idle 不可预览", () => {
    const usage = projectContextUsage(estimate)

    expect(usage?.segments.map((segment) => segment.id)).toEqual([
      "systemPrompt",
      "memory",
      "skills",
      "tools",
      "toolResults",
      "conversation",
      "other",
      "idle",
    ])
    expect(usage?.segments.map((segment) => segment.tokens)).toEqual([
      100, 0, 20, 300, 400, 680, 0, 0,
    ])
    expect(usage?.segments.every((segment) => segment.color.startsWith("var(--"))).toBe(true)
    expect(usage?.segments.every((segment) => segment.label.length > 0)).toBe(true)
    expect(usage?.segments.filter((segment) => !segment.previewable).map((s) => s.id)).toEqual([
      "other",
      "idle",
    ])

    const sparse = projectContextUsage({
      used: 10,
      window: 100,
      segments: { systemPrompt: 10 } as ContextUsageEstimate["segments"],
    })

    expect(sparse?.segments.every((segment) => Number.isFinite(segment.tokens))).toBe(true)
    expect(sparse?.segments[0]?.tokens).toBe(10)
    expect(sparse?.segments[1]?.tokens).toBe(0)
  })
})

describe("context usage 文案", () => {
  it("token 量级按三档取整", () => {
    expect(formatTokenCount(-1)).toBe("0")
    expect(formatTokenCount(999)).toBe("999")
    expect(formatTokenCount(15_234)).toBe("15.2K")
    expect(formatTokenCount(99_999)).toBe("100.0K")
    expect(formatTokenCount(1_234_567)).toBe("1235K")
  })

  it("摘要用同一套量级", () => {
    const usage = projectContextUsage({ ...estimate, used: 300, window: 1000 })

    expect(usage && contextUsageSummary(usage)).toBe("300 / 1.0K tokens")
  })

  it("分段占比在零窗口和负值下归零", () => {
    expect(segmentShare(50, 100)).toBe(50)
    expect(segmentShare(200, 100)).toBe(100)
    expect(segmentShare(0, 100)).toBe(0)
    expect(segmentShare(-5, 100)).toBe(0)
    expect(segmentShare(50, 0)).toBe(0)
  })
})
