import { describe, expect, it } from "vitest"
import { estimateContextUsage } from "../src/pi/context-usage.js"

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

  it("声明给模型的 MCP 工具单列一类，不算进工具定义；未声明的不计", () => {
    const tools = [
      { name: "read", description: "Read a file", parameters: {} },
      { name: "mcp__docs__search", description: "Search docs", parameters: {} },
      { name: "mcp__docs__fetch", description: "Fetch a doc", parameters: {} },
    ]
    const builtinOnly = estimateContextUsage(source({ getAllTools: () => tools }))
    const usage = estimateContextUsage(
      source({
        getAllTools: () => tools,
        getActiveToolNames: () => ["read", "mcp__docs__search"],
      }),
      "mcpTools",
    )

    expect(builtinOnly.segments.mcpTools).toBe(0)
    expect(usage.segments.tools).toBe(builtinOnly.segments.tools)
    expect(usage.segments.mcpTools).toBeGreaterThan(0)
    expect(usage.preview?.content).toContain("mcp__docs__search")
    expect(usage.preview?.content).not.toContain("mcp__docs__fetch")
  })
})
