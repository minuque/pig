import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import { afterEach, describe, expect, it } from "vitest"
import { SessionIndex } from "../src/pi/session-index.js"

let root: string | undefined

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

const assistant = (text: string, timestamp: number) =>
  ({
    role: "assistant",
    content: [{ type: "text", text }],
    api: "test",
    provider: "test",
    model: "m",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp,
  }) as never

function seed(sessionDir: string, id: string, cwd: string, prompt: string, at: number) {
  const manager = SessionManager.create(cwd, sessionDir, { id })
  manager.appendMessage({ role: "user", content: prompt, timestamp: at })
  manager.appendMessage(assistant("好", at + 1000))
  return manager
}

describe("会话索引：侧栏元数据与 pi 自己的列表一致", () => {
  it("id、目录、首句名与最近活动时间同 SessionManager.listAll，改名后列表跟上", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-index-"))
    const dir = join(root, "sessions")
    seed(dir, "a", join(root, "w1"), "第一个会话的提问", 1_000_000)
    const b = seed(dir, "b", join(root, "w2"), "第二个", 2_000_000)
    const index = new SessionIndex(dir)
    const expected = (await SessionManager.listAll(dir)).map((info) => ({
      id: info.id,
      cwd: info.cwd,
      name: info.name ?? info.firstMessage,
      updatedAt: info.modified.getTime(),
    }))
    const actual = (await index.list()).map((info) => ({
      id: info.id,
      cwd: info.cwd,
      name: info.name ?? info.firstMessage,
      updatedAt: info.modified.getTime(),
    }))

    expect(actual).toEqual(expected)

    b.appendSessionInfo("改过的名字")
    const renamed = (await index.list()).find((info) => info.id === "b")
    expect(renamed?.name).toBe("改过的名字")
  })

  it("subagent 开的子会话标记出来，侧栏不列", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-index-"))
    const dir = join(root, "sessions")
    seed(dir, "parent", join(root, "w"), "主会话", 1_000_000)

    const child = SessionManager.create(join(root, "w"), dir, {
      id: "child",
      parentSession: "parent.jsonl",
    })

    child.appendCustomEntry("pig.subagent", { agent: "scout" })
    child.appendMessage({ role: "user", content: "子任务", timestamp: 1_000_500 })
    child.appendMessage(assistant("好", 1_000_600))

    const listed = await new SessionIndex(dir).list()
    expect(listed.find((info) => info.id === "child")?.subagent).toBe(true)
    expect(listed.find((info) => info.id === "parent")?.subagent).toBeUndefined()
  })
})
