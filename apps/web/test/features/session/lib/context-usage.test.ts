import { describe, expect, it } from "vitest"
import type { ContextUsageEstimate, ContextUsageTokens } from "@pig/protocol"
import { projectContextUsage } from "@features/session/lib/context-usage.js"

function estimate(tokens?: ContextUsageTokens): ContextUsageEstimate {
  return {
    used: 300,
    window: 1000,
    mcpToolCount: 0,
    ...(tokens ? { tokens } : {}),
    segments: {
      systemPrompt: 120,
      memory: 0,
      skills: 0,
      tools: 40,
      mcpTools: 0,
      toolResults: 0,
      conversation: 140,
      other: 0,
      idle: 700,
    },
  }
}

describe("projectContextUsage", () => {
  it("累计用量补上缓存命中率，分子只算命中的读取", () => {
    const usage = projectContextUsage(
      estimate({ input: 250, output: 30, cacheRead: 750, cacheWrite: 0, total: 1030 }),
    )

    expect(usage?.tokens).toEqual({
      input: 250,
      output: 30,
      cacheRead: 750,
      cacheWrite: 0,
      total: 1030,
      cacheHitRate: 75,
    })
    expect(usage?.percent).toBe(30)
  })

  it("命中率保留一位小数，写入的 token 也算进分母", () => {
    const usage = projectContextUsage(
      estimate({ input: 100, output: 0, cacheRead: 200, cacheWrite: 100, total: 400 }),
    )

    expect(usage?.tokens?.cacheHitRate).toBe(50)
  })

  it("没有会话统计时不给缓存段，分母为零也不编命中率", () => {
    expect(projectContextUsage(estimate())?.tokens).toBeUndefined()

    const empty = projectContextUsage(
      estimate({ input: 0, output: 12, cacheRead: 0, cacheWrite: 0, total: 12 }),
    )

    expect(empty?.tokens?.cacheHitRate).toBeNull()
    expect(empty?.tokens?.output).toBe(12)
  })
})
