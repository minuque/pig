import { describe, expect, it } from "vitest"
import { estimateContextUsage, resolveUsedTokens } from "../src/pi/context-usage.js"

function source(overrides: Record<string, unknown> = {}) {
  return {
    systemPrompt: "s".repeat(400),
    model: { contextWindow: 1000 },
    getContextUsage: () => ({ tokens: 300, contextWindow: 1000, percent: 30 }),
    getActiveToolNames: () => ["read"],
    getAllTools: () => [{ name: "read", description: "Read a file", parameters: {} }],
    sessionManager: {
      buildContextEntries: () => [
        {
          type: "message",
          message: { role: "user" as const, content: "m".repeat(80), timestamp: 1 },
        },
      ],
    },
    resourceLoader: {
      getAgentsFiles: () => ({
        agentsFiles: [{ path: "AGENTS.md", content: "a".repeat(80) }],
      }),
      getSkills: () => ({ skills: [] }),
    },
    ...overrides,
  }
}

describe("estimateContextUsage", () => {
  it("以 Pi 总占用校准来源估算，差额归入其他，剩余归入空闲", () => {
    const usage = estimateContextUsage(source())
    const { idle, ...usedSegments } = usage.segments
    expect(usage.used).toBe(300)
    expect(usage.window).toBe(1000)
    expect(Object.values(usedSegments).reduce((sum: number, value) => sum + Number(value), 0)).toBe(
      300,
    )
    expect(idle).toBe(700)
    expect(usage.segments.systemPrompt).toBeGreaterThan(0)
    expect(usage.segments.tools).toBeGreaterThan(0)
    expect(usage.segments.conversation).toBeGreaterThan(0)
    expect(usage.segments.skills).toBe(0)
    expect(usage.segments.toolResults).toBe(0)
  })
})

describe("resolveUsedTokens", () => {
  it("上报 tokens 与 percent 显著不一致时优先 percent，明显偏小则回退估算", () => {
    expect(resolveUsedTokens({ tokens: 1, percent: 7 }, 20_000, 272_000)).toBe(19_040)
    expect(resolveUsedTokens({ tokens: 19_000, percent: 7 }, 20_000, 272_000)).toBe(19_000)
    expect(resolveUsedTokens({ tokens: 1, percent: 1 / 2720 }, 20_000, 272_000)).toBe(20_000)
    expect(resolveUsedTokens({ tokens: null, percent: null }, 20_000, 272_000)).toBe(20_000)
  })
})
