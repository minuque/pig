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
  })

  it("未嵌进 system prompt 的 Memory 不计占用", () => {
    const usage = estimateContextUsage({
      ...source(),
      getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
      resourceLoader: {
        getAgentsFiles: () => ({
          agentsFiles: [{ path: "AGENTS.md", content: "cccc" }],
        }),
        getSkills: () => ({ skills: [] }),
      },
    })

    expect(usage.segments.memory).toBe(0)
  })

  it("嵌进 system prompt 的 Memory 只计一次", () => {
    const memory = "cccc"
    const usage = estimateContextUsage({
      ...source(),
      systemPrompt: `base\n${memory}`,
      getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
      resourceLoader: {
        getAgentsFiles: () => ({
          agentsFiles: [{ path: "AGENTS.md", content: memory }],
        }),
        getSkills: () => ({ skills: [] }),
      },
      sessionManager: { buildContextEntries: () => [] },
      getActiveToolNames: () => [],
      getAllTools: () => [],
    })

    expect(usage.segments.memory).toBe(1)
    expect(usage.segments.systemPrompt + usage.segments.memory).toBe(
      Math.ceil("base\ncccc".length / 4),
    )
  })

  it("来源估算超过上报总量时只压缩 Tool 结果与会话分段", () => {
    const estimated = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }) }),
    )
    const fixed =
      estimated.segments.systemPrompt +
      estimated.segments.memory +
      estimated.segments.skills +
      estimated.segments.tools
    const variable = estimated.segments.toolResults + estimated.segments.conversation
    const target = fixed + Math.floor(variable / 2)
    const usage = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: target, contextWindow: 1000, percent: null }) }),
    )

    expect(usage.used).toBe(target)
    expect(usage.segments.systemPrompt).toBe(estimated.segments.systemPrompt)
    expect(usage.segments.memory).toBe(estimated.segments.memory)
    expect(usage.segments.skills).toBe(estimated.segments.skills)
    expect(usage.segments.tools).toBe(estimated.segments.tools)
    expect(usage.segments.toolResults + usage.segments.conversation).toBe(target - fixed)
  })

  it("总占用不低于固定分段", () => {
    const estimated = estimateContextUsage(
      source({ getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }) }),
    )
    const fixed =
      estimated.segments.systemPrompt +
      estimated.segments.memory +
      estimated.segments.skills +
      estimated.segments.tools
    const usage = estimateContextUsage(
      source({
        getContextUsage: () => ({ tokens: fixed - 1, contextWindow: 1000, percent: null }),
      }),
    )

    expect(usage.used).toBe(fixed)
    expect(usage.segments.conversation).toBe(0)
    expect(usage.segments.toolResults).toBe(0)
  })

  it("Tool 结果从会话上下文拆出", () => {
    const usage = estimateContextUsage(
      source({
        getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
        sessionManager: {
          buildContextEntries: () => [
            {
              type: "message",
              message: { role: "user", content: "uuuuuuuu", timestamp: 0 },
            },
            {
              type: "message",
              message: {
                role: "assistant",
                content: [
                  { type: "text", text: "aaaa" },
                  { type: "toolCall", id: "1", name: "read", arguments: { path: "a" } },
                ],
              },
            },
            {
              type: "message",
              message: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "read",
                content: "rrrrrrrr",
                timestamp: 0,
              },
            },
          ],
        },
      }),
    )

    expect(usage.segments.toolResults).toBeGreaterThan(0)
    expect(usage.segments.conversation).toBeGreaterThan(0)
  })

  it("按类别返回预览正文", () => {
    const usage = estimateContextUsage(
      source({
        systemPrompt: "base\ncccc",
        getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
        resourceLoader: {
          getAgentsFiles: () => ({ agentsFiles: [{ path: "AGENTS.md", content: "cccc" }] }),
          getSkills: () => ({ skills: [] }),
        },
        sessionManager: {
          buildContextEntries: () => [
            {
              type: "message",
              message: {
                role: "toolResult",
                toolCallId: "1",
                toolName: "read",
                content: "rrrrrrrr",
                timestamp: 0,
              },
            },
          ],
        },
      }),
      "memory",
    )

    expect(usage.preview).toMatchObject({
      key: "memory",
      title: "记忆",
    })
    expect(usage.preview?.content).toContain("AGENTS.md")
    expect(usage.preview?.content).toContain("cccc")
    expect(
      estimateContextUsage(
        source({
          getContextUsage: () => ({ tokens: null, contextWindow: 1000, percent: null }),
          sessionManager: {
            buildContextEntries: () => [
              {
                type: "message",
                message: {
                  role: "toolResult",
                  toolCallId: "1",
                  toolName: "read",
                  content: "rrrrrrrr",
                  timestamp: 0,
                },
              },
            ],
          },
        }),
        "toolResults",
      ).preview?.content,
    ).toContain("rrrrrrrr")
  })
})

describe("resolveUsedTokens", () => {
  it("上报 tokens 与 percent 显著不一致时优先 percent", () => {
    expect(resolveUsedTokens({ tokens: 1, percent: 7 }, 20_000, 272_000)).toBe(19_040)
    expect(resolveUsedTokens({ tokens: 19_000, percent: 7 }, 20_000, 272_000)).toBe(19_000)
  })

  it("上报值明显小于内容估算时回退估算", () => {
    expect(resolveUsedTokens({ tokens: 1, percent: 1 / 2720 }, 20_000, 272_000)).toBe(20_000)
    expect(resolveUsedTokens({ tokens: null, percent: null }, 20_000, 272_000)).toBe(20_000)
  })
})
