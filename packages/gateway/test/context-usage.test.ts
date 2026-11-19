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
    expect(Object.values(usage.segments).every((value) => typeof value === "number")).toBe(true)
    expect(usage.segments.systemPrompt).toBeGreaterThan(0)
    expect(usage.segments.tools).toBeGreaterThan(0)
    expect(usage.segments.conversation).toBeGreaterThan(0)
    expect(usage.segments.skills).toBe(0)
    expect(usage.segments.toolResults).toBe(0)
  })

  it("声明给模型的 MCP 工具单列一类，不算进工具定义；按需加载的不占用，但计数并在预览里列出", () => {
    const docs = { name: "mcp__docs" }
    const tools = [
      { name: "read", description: "Read a file", parameters: {} },
      { name: "mcp__docs__search", description: "Search docs", parameters: {}, namespace: docs },
      {
        name: "mcp__docs__fetch",
        description: "Fetch a doc",
        parameters: {},
        exposure: "deferred",
        namespace: docs,
      },
      { name: "mcp__docs__secret", description: "", parameters: {}, exposure: "hidden" },
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
    expect(usage.mcpToolCount).toBe(2)
    expect(usage.preview?.content).toContain("## 定义：mcp__docs__search")
    expect(usage.preview?.content).toContain("## 按需加载：mcp__docs")
    expect(usage.preview?.content).toContain("- `mcp__docs__fetch`")
    expect(usage.preview?.content).not.toContain("Fetch a doc")
    expect(usage.preview?.content).not.toContain("mcp__docs__secret")
  })

  it("codemode 脚本实际调过 MCP 工具，这次调用与结果算进 MCP；只提到 mcp__ 没调的仍归消息与工具结果", () => {
    const call = (id: string, code: string) => ({
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id, name: "codemode", arguments: { code } }],
      },
    })
    const result = (id: string, text: string, called: string[]) => ({
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: id,
        toolName: "codemode",
        content: [{ type: "text", text }],
        details: { calls: called.map((name, n) => ({ id: `${id}/${n}`, name, status: "ok" })) },
      },
    })
    const entries = [
      call("a", "await tools.mcp__docs__search({ q: 'x' })"),
      result("a", "r".repeat(400), ["mcp__docs__search"]),
      call("b", "console.log(ALL_TOOLS.filter((n) => n.startsWith('mcp__')))"),
      result("b", "1", []),
    ]
    const usage = estimateContextUsage(
      source({
        getContextUsage: () => undefined,
        sessionManager: { buildContextEntries: () => entries },
      }),
      "mcpTools",
    )

    expect(usage.segments.mcpTools).toBeGreaterThan(100)
    expect(usage.segments.toolResults).toBeGreaterThan(0)
    expect(usage.segments.toolResults).toBeLessThan(usage.segments.mcpTools)
    expect(usage.preview?.content).toContain("## 调用：codemode")
    expect(usage.preview?.content).toContain("r".repeat(400))
    expect(usage.preview?.content).not.toContain("ALL_TOOLS")
  })

  it("预算只剩 1 token 时工具结果与 MCP 同时向上取整也不会超预算", () => {
    const toolResult = (id: string, name: string) => ({
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: id,
        toolName: name,
        content: [{ type: "text", text: "hi" }],
      },
    })
    const usage = estimateContextUsage(
      source({
        systemPrompt: "",
        getContextUsage: () => ({ tokens: 1, contextWindow: 1000, percent: null }),
        getActiveToolNames: () => [],
        getAllTools: () => [],
        sessionManager: {
          buildContextEntries: () => [toolResult("a", "read"), toolResult("b", "mcp__docs")],
        },
        resourceLoader: {
          getAgentsFiles: () => ({ agentsFiles: [] }),
          getSkills: () => ({ skills: [] }),
        },
      }),
    )
    const { idle, ...usedSegments } = usage.segments

    expect(usage.used).toBe(1)
    expect(usage.segments.toolResults).toBe(1)
    expect(usage.segments.mcpTools).toBe(0)
    expect(usage.segments.conversation).toBe(0)
    expect(Object.values(usedSegments).every((value) => Number(value) >= 0)).toBe(true)
    expect(Object.values(usedSegments).reduce((sum: number, value) => sum + Number(value), 0)).toBe(
      usage.used,
    )
    expect(idle).toBe(999)
  })
})
