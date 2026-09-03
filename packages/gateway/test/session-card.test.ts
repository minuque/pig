import { describe, expect, it } from "vitest"
import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import { modelFromBranch, outcomeFromBranch } from "../src/pi/session-card.js"

function modelChange(provider: string, modelId: string): SessionEntry {
  return {
    type: "model_change",
    id: modelId,
    parentId: null,
    timestamp: "1",
    provider,
    modelId,
  }
}

function assistant(stopReason: "stop" | "error"): SessionEntry {
  return {
    type: "message",
    id: `assistant-${stopReason}`,
    parentId: null,
    timestamp: "2026-09-03T00:00:00.000Z",
    message: {
      role: "assistant",
      content: [{ type: "text", text: stopReason }],
      api: "test",
      provider: "test",
      model: "test",
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason,
      timestamp: 1,
    },
  }
}

describe("modelFromBranch", () => {
  it("returns the last model_change on the branch", () => {
    expect(modelFromBranch([])).toBeUndefined()
    expect(
      modelFromBranch([
        modelChange("openai", "gpt-4"),
        { type: "session_info", id: "n", parentId: null, timestamp: "1", name: "x" },
        modelChange("openai", "o3"),
      ]),
    ).toEqual({ provider: "openai", id: "o3" })
  })
})

describe("outcomeFromBranch", () => {
  it("以当前分支最后一条助手消息判定失败", () => {
    expect(outcomeFromBranch([])).toBeUndefined()
    expect(outcomeFromBranch([assistant("error")])).toBe("error")
    expect(outcomeFromBranch([assistant("error"), assistant("stop")])).toBe("complete")
  })
})
