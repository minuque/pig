import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { Command, ServerMessage, SessionTranscriptPage } from "@pig/protocol"
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
  checkAuth: async () => true,
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
let socket: WebSocket | undefined
let root: string | undefined

afterEach(async () => {
  socket?.close()
  socket = undefined
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

function append(manager: SessionManager, question: string, answer: string, timestamp: number) {
  manager.appendMessage({ role: "user", content: question, timestamp })
  manager.appendMessage({
    role: "assistant",
    content: [{ type: "text", text: answer }],
    api: "test",
    provider: "test",
    model: "test-model",
    usage,
    stopReason: "stop",
    timestamp: timestamp + 1,
  } as never)
}

/** 磁盘上一个回合已结束的会话，pig 挂上后成为活会话。 */
async function start() {
  root = await mkdtemp(join(tmpdir(), "pig-append-"))
  const sessionDir = join(root, "sessions")
  const manager = SessionManager.create(join(root, "work"), sessionDir, { id: "s-1" })
  manager.appendModelChange("test", "test-model")
  append(manager, "第一句", "第一答", 1000)
  gateway = new Gateway({ sessionDir, cwd: root, createRuntime: async () => runtime as never })
  const port = await gateway.start()
  const authorization = gateway.authorizationHeader()
  const transcript = async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/platform/transcript?sessionId=s-1`, {
      headers: { authorization },
    })
    return (await res.json()) as SessionTranscriptPage
  }

  return { path: manager.getSessionFile() as string, transcript, ...(await connect(port)) }
}

async function connect(port: number) {
  const ws = (socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization: gateway?.authorizationHeader() ?? "" },
  }))
  const inbox: ServerMessage[] = []
  const waiters: Array<() => void> = []
  ws.on("message", (data) => {
    inbox.push(JSON.parse(String(data)) as ServerMessage)

    for (const wake of waiters.splice(0)) wake()
  })
  await new Promise((resolve, reject) => ws.once("open", resolve).once("error", reject))

  const next = async (match: (message: ServerMessage) => boolean) => {
    for (;;) {
      const found = inbox.find(match)

      if (found) return found
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }
  let seq = 0
  const request = async (command: Command) => {
    const id = `r${++seq}`
    ws.send(JSON.stringify({ type: "request", id, command }))
    return next((message) => message.type === "response" && message.id === id)
  }

  ws.send(JSON.stringify({ type: "hello", version: 1 }))
  await next((message) => message.type === "hello")
  return { request }
}

/** 另开一个 SessionManager 追加一轮：这就是 TUI。 */
function appendExternalTurn(path: string) {
  append(SessionManager.open(path), "外部提问", "外部回答", 5000)
}

const texts = (page: SessionTranscriptPage) =>
  "items" in page
    ? page.items.flatMap((item) =>
        "content" in item && Array.isArray(item.content)
          ? item.content.flatMap((block) => ("text" in block ? [block.text] : []))
          : [],
      )
    : []

describe("pig 持有会话时文件被外部追加", () => {
  it("pig 自己写入不误判；外部追加后历史读盘，挂着的连接下一条命令得知", async () => {
    const { path, transcript, request } = await start()

    expect(await request({ command: "attach_session", sessionId: "s-1" })).toMatchObject({
      ok: true,
    })
    // 活会话的历史不带文件版本
    expect(await transcript()).not.toHaveProperty("version")

    // set_model 经 pig 的 SessionManager 追加 model_change：文件变了，但条目数对得上
    expect(
      await request({
        command: "set_model",
        sessionId: "s-1",
        model: { provider: "test", id: "test-model" },
      }),
    ).toMatchObject({ ok: true })
    expect(await transcript()).not.toHaveProperty("version")

    appendExternalTurn(path)
    const page = await transcript()

    expect(page).toHaveProperty("version")
    expect(texts(page)).toEqual(["第一句", "第一答", "外部提问", "外部回答"])
    expect(await request({ command: "prompt", sessionId: "s-1", message: "接着说" })).toMatchObject(
      { ok: false, error: { code: "session_changed_elsewhere" } },
    )
  })

  it("prompt 时发现：回 session_changed_elsewhere，不交给 pi；放掉后重新挂上可用", async () => {
    const { path, transcript, request } = await start()

    await request({ command: "attach_session", sessionId: "s-1" })
    appendExternalTurn(path)
    const before = SessionManager.open(path).getEntries()

    expect(await request({ command: "prompt", sessionId: "s-1", message: "接着说" })).toMatchObject(
      { ok: false, error: { code: "session_changed_elsewhere" } },
    )
    expect(SessionManager.open(path).getEntries()).toEqual(before)
    expect(texts(await transcript())).toEqual(["第一句", "第一答", "外部提问", "外部回答"])

    await request({ command: "detach_session", sessionId: "s-1" })
    expect(await request({ command: "attach_session", sessionId: "s-1" })).toMatchObject({
      ok: true,
    })
  })
})
