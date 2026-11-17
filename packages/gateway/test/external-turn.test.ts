import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { ClientMessage, ServerMessage, SessionTranscriptPage } from "@pig/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"

const model = {
  provider: "test",
  id: "test-model",
  name: "Test Model",
  api: "test",
  reasoning: false,
  input: ["text"],
  contextWindow: 1000,
  maxTokens: 1000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}
const runtime = {
  getAvailable: async () => [model],
  hasConfiguredAuth: () => true,
  getModel: () => model,
}
const usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}
let gateway: Gateway | undefined
let root: string | undefined

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

/** 磁盘上一个停在用户消息上的会话：TUI 正在跑回合。 */
async function start() {
  root = await mkdtemp(join(tmpdir(), "pig-external-"))
  const sessionDir = join(root, "sessions")
  const manager = SessionManager.create(join(root, "work"), sessionDir, { id: "s-1" })
  manager.appendModelChange("test", "test-model")
  manager.appendMessage({ role: "user", content: "第一句", timestamp: 1000 })
  gateway = new Gateway({ sessionDir, cwd: root, createRuntime: async () => runtime as never })
  const port = await gateway.start()
  const headers = { authorization: gateway.authorizationHeader() }
  const transcript = async (known?: string) => {
    const query = known ? `&known=${encodeURIComponent(known)}` : ""
    const res = await fetch(
      `http://127.0.0.1:${port}/api/v1/platform/transcript?sessionId=s-1${query}`,
      { headers },
    )
    return (await res.json()) as SessionTranscriptPage
  }

  return { path: manager.getSessionFile() as string, port, transcript }
}

describe("别处正在跑回合：历史接口", () => {
  it("未结束的磁盘会话报 externalTurn；版本相同回 unchanged；被外部追加后给新版本和全文", async () => {
    const { path, transcript } = await start()
    const first = await transcript()

    if ("unchanged" in first) throw new Error("expected a full page")
    expect(first.externalTurn).toBe(true)
    expect(first.version).toBeTruthy()
    expect(await transcript(first.version)).toEqual({ unchanged: true })

    // 另一个 SessionManager 就是外部写入方
    SessionManager.open(path).appendMessage({
      role: "assistant",
      content: [{ type: "text", text: "回答" }],
      api: "test",
      provider: "test",
      model: "test-model",
      usage,
      stopReason: "stop",
      timestamp: 2000,
    } as never)

    const next = await transcript(first.version)

    if ("unchanged" in next) throw new Error("expected a full page")
    expect(next.version).not.toBe(first.version)
    expect(next.items.map((item) => item.role)).toEqual(["user", "assistant"])
    expect(next.externalTurn).toBe(false)
  })
})

async function attach(port: number, takeover?: boolean) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization: gateway?.authorizationHeader() ?? "" },
  })
  const inbox: ServerMessage[] = []
  const waiters: Array<() => void> = []
  socket.on("message", (data) => {
    inbox.push(JSON.parse(String(data)) as ServerMessage)

    for (const wake of waiters.splice(0)) wake()
  })
  await new Promise((resolve, reject) => socket.once("open", resolve).once("error", reject))

  const next = async (match: (message: ServerMessage) => boolean) => {
    for (;;) {
      const found = inbox.find(match)

      if (found) return found
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }
  const send = (message: ClientMessage) => socket.send(JSON.stringify(message))

  send({ type: "hello", version: 1 })
  await next((message) => message.type === "hello")
  send({
    type: "request",
    id: "a1",
    command: { command: "attach_session", sessionId: "s-1", ...(takeover ? { takeover } : {}) },
  })
  const reply = await next((message) => message.type === "response" && message.id === "a1")
  socket.close()
  return reply
}

describe("别处正在跑回合：挂载守门", () => {
  it("不带 takeover 被 session_locked 拒绝", async () => {
    const { port } = await start()
    expect(await attach(port)).toMatchObject({ ok: false, error: { code: "session_locked" } })
  })

  it("带 takeover 挂载成功", async () => {
    const { port } = await start()
    expect(await attach(port, true)).toMatchObject({ ok: true })
  })
})
