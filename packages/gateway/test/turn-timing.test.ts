import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import { afterEach, describe, expect, it } from "vitest"
import { readTurnTimings } from "../src/pi/turn-timing.js"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe("会话文件里的回合计时 → HTTP 历史", () => {
  it("每条用户消息取最后一条有效计时，悬空与坏数据丢掉，重新打开仍在", async () => {
    const directory = await mkdtemp(join(tmpdir(), "pig-timing-"))
    directories.push(directory)
    const manager = SessionManager.create(directory, directory)
    const userId = manager.appendMessage({ role: "user", content: "执行任务", timestamp: 1000 })
    manager.appendCustomEntry("pig.turn-timing", { userId, startedAt: 1000, outcome: "running" })
    manager.appendMessage({
      role: "assistant",
      api: "openai-responses",
      provider: "test",
      model: "test",
      content: [{ type: "text", text: "完成" }],
      timestamp: 2000,
      stopReason: "stop",
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    })
    const ended = { userId, startedAt: 1000, endedAt: 66000, outcome: "aborted" }
    manager.appendCustomEntry("pig.turn-timing", ended)
    manager.appendCustomEntry("pig.turn-timing", {
      userId: "gone",
      startedAt: 1,
      outcome: "running",
    })
    manager.appendCustomEntry("pig.turn-timing", { userId, startedAt: 1000, endedAt: 1 })

    expect(readTurnTimings(manager.getBranch())).toEqual([ended])
    const file = manager.getSessionFile()

    if (!file) throw new Error("Missing persisted session")
    expect(readTurnTimings(SessionManager.open(file).getBranch())).toEqual([ended])
  })
})
