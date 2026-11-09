import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptItem } from "@pig/protocol"
import { afterEach, describe, expect, it } from "vitest"

import Gateway from "../src/index.js"

let gateway: Gateway | undefined
let root: string | undefined

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}
const BIG_OUTPUT = "x".repeat(200_000)

function seedLongSession(sessionDir: string, cwd: string) {
  const manager = SessionManager.create(cwd, sessionDir, { id: "long" })

  for (let turn = 0; turn < 10; turn += 1) {
    const at = 1_000_000 + turn * 10_000
    manager.appendMessage({ role: "user", content: `第 ${turn} 问`, timestamp: at })
    manager.appendMessage({
      role: "assistant",
      content: [{ type: "toolCall", id: `call-${turn}`, name: "bash", arguments: { cmd: "ls" } }],
      api: "test",
      provider: "test",
      model: "m",
      usage,
      stopReason: "toolUse",
      timestamp: at + 1,
    } as never)
    manager.appendMessage({
      role: "toolResult",
      toolCallId: `call-${turn}`,
      toolName: "bash",
      content: [{ type: "text", text: BIG_OUTPUT }],
      isError: false,
      timestamp: at + 2,
    } as never)
  }
}

describe("打开长会话：历史一次给全，大块工具输出按需取", () => {
  it("一次拿到全部十轮，工具输出只给摘要，按 id 取回原文", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-history-"))
    const sessionDir = join(root, "sessions")
    seedLongSession(sessionDir, join(root, "work"))
    gateway = new Gateway({ sessionDir, cwd: root })
    const base = `http://127.0.0.1:${await gateway.start()}`
    const headers = { authorization: gateway.authorizationHeader() }
    const page = (await (
      await fetch(`${base}/api/v1/platform/transcript?sessionId=long`, { headers })
    ).json()) as { items: TranscriptItem[]; hasMore: boolean }

    expect(page.hasMore).toBe(false)
    expect(page.items.filter((item) => item.role === "user")).toHaveLength(10)

    const tool = page.items.find((item) => item.role === "tool")
    const text = tool?.content.find((part) => part.type === "text")
    expect(tool && "truncated" in tool && tool.truncated).toBe(true)
    expect(text && "text" in text ? text.text.length : 0).toBeLessThan(BIG_OUTPUT.length)

    const full = (await (
      await fetch(`${base}/api/v1/platform/transcript/item?sessionId=long&id=${tool?.id}`, {
        headers,
      })
    ).json()) as { item: TranscriptItem }
    const fullText = full.item.content.find((part) => part.type === "text")
    expect(fullText && "text" in fullText ? fullText.text : "").toBe(BIG_OUTPUT)
  })
})
