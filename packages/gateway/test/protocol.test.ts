import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { ClientMessage, Command, ServerMessage, SessionSnapshot } from "@pig/protocol"
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
  getModel: (provider: string, id: string) =>
    provider === model.provider && id === model.id ? model : undefined,
}
let gateway: Gateway | undefined
let root: string | undefined

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

/** 一条已握手的连接：按 id 等响应，按谓词等事件。 */
async function connect(port: number) {
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
      const index = inbox.findIndex(match)

      if (index >= 0) return inbox.splice(index, 1)[0] as ServerMessage
      await new Promise<void>((resolve) => waiters.push(resolve))
    }
  }
  const send = (message: ClientMessage) => socket.send(JSON.stringify(message))
  let seq = 0
  const request = async (command: Command) => {
    const id = `r${(seq += 1)}`
    send({ type: "request", id, command })
    return next((message) => message.type === "response" && message.id === id)
  }

  send({ type: "hello", version: 1 })
  const hello = await next((message) => message.type === "hello")
  return { socket, hello, request, next }
}

describe("pig 协议：断线重连后会话完整恢复", () => {
  it("新连接 attach 已有会话，快照空闲可用，历史经 HTTP 完整取回，握手快照列出该会话", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-protocol-"))
    const cwd = join(root, "work")
    const sessionDir = join(root, "sessions")
    const manager = SessionManager.create(cwd, sessionDir, { id: "s-1" })
    manager.appendModelChange("test", "test-model")
    manager.appendMessage({ role: "user", content: "第一句", timestamp: 1000 })
    manager.appendMessage({
      role: "assistant",
      content: [{ type: "text", text: "回答" }],
      api: "test",
      provider: "test",
      model: "test-model",
      usage: {
        input: 1,
        output: 1,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 2,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 2000,
    } as never)

    gateway = new Gateway({ sessionDir, cwd, createRuntime: async () => runtime as never })
    const port = await gateway.start()
    const first = await connect(port)
    expect(first.hello.type === "hello" && first.hello.snapshot.sessions.map((s) => s.id)).toEqual([
      "s-1",
    ])
    await first.request({ command: "attach_session", sessionId: "s-1" })
    first.socket.close()

    const second = await connect(port)
    const reply = await second.request({ command: "attach_session", sessionId: "s-1" })
    expect(reply.type === "response" && reply.ok).toBe(true)
    const session = (reply as { result: { session: SessionSnapshot } }).result.session
    expect(session.attached).toBe(true)
    expect(session.phase).toBe("idle")

    const history = await fetch(
      `http://127.0.0.1:${port}/api/v1/platform/transcript?sessionId=s-1`,
      { headers: { authorization: gateway.authorizationHeader() } },
    )
    const body = (await history.json()) as { items: Array<{ role: string }> }
    expect(body.items.map((item) => item.role)).toEqual(["user", "assistant"])
    second.socket.close()
  })

  it("未 attach 就发 prompt 被拒为 invalid_request，连接不断", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-protocol-"))
    gateway = new Gateway({
      sessionDir: root,
      cwd: root,
      createRuntime: async () => runtime as never,
    })
    const client = await connect(await gateway.start())
    const reply = await client.request({ command: "prompt", sessionId: "nope", message: "hi" })
    expect(reply).toMatchObject({ type: "response", ok: false, error: { code: "invalid_request" } })
    expect(client.socket.readyState).toBe(WebSocket.OPEN)
    client.socket.close()
  })
})

describe("扩展弹框：在客户端作答，扩展拿到结果", () => {
  it("扩展命令里的 confirm 发到客户端，回答后扩展用 notify 回报结果", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-ext-ui-"))
    const agentDir = join(root, "agent")
    await mkdir(join(agentDir, "extensions"), { recursive: true })
    await writeFile(
      join(agentDir, "extensions", "ask.ts"),
      `export default function (pi) {
        pi.registerCommand("ask", {
          description: "ask",
          handler: async (_args, ctx) => {
            const ok = await ctx.ui.confirm("继续吗", "要不要继续")
            ctx.ui.notify(ok ? "答了是" : "答了否", "info")
          },
        })
      }`,
    )
    const cwd = join(root, "work")
    await mkdir(cwd)
    gateway = new Gateway({
      sessionDir: join(root, "sessions"),
      cwd,
      agentDir,
    })
    const client = await connect(await gateway.start())
    const created = await client.request({ command: "create_session", cwd })
    const sessionId = (created as { result: { session: SessionSnapshot } }).result.session.id
    void client.request({ command: "prompt", sessionId, message: "/ask" })

    // 本机装的其他扩展也可能先发状态栏更新：只等 confirm
    const ask = await client.next(
      (message) =>
        message.type === "event" &&
        message.event.type === "extension_ui_request" &&
        message.event.request.method === "confirm",
    )
    const request = (ask as { event: { request: { id: string; method: string; title: string } } })
      .event.request

    expect(request).toMatchObject({ method: "confirm", title: "继续吗" })

    await client.request({
      command: "extension_ui_response",
      sessionId,
      response: { id: request.id, confirmed: true },
    })

    const notified = await client.next(
      (message) =>
        message.type === "event" &&
        message.event.type === "extension_ui_request" &&
        message.event.request.method === "notify",
    )

    expect(notified).toMatchObject({ event: { request: { message: "答了是" } } })
    client.socket.close()
  }, 30_000)
})

describe("后台任务：扩展经事件总线上报，客户端能看到、能停", () => {
  it("任务进快照；没人连着时会话不销毁；按 id 停止；结束通知进时间线", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-bg-task-"))
    const agentDir = join(root, "agent")
    await mkdir(join(agentDir, "extensions"), { recursive: true })
    // 替身扩展：用和内置 tasks 扩展相同的总线频道与消息类型
    await writeFile(
      join(agentDir, "extensions", "bg.ts"),
      `export default function (pi) {
        pi.registerCommand("bg", {
          description: "bg",
          handler: async (_args, ctx) => {
            const sessionId = ctx.sessionManager.getSessionId()
            const task = { id: "bash:t1", kind: "bash", description: "开发服务器", command: "pnpm dev", status: "running", output: "ready" }
            pi.events.emit("pig:tasks", { sessionId, tasks: [task] })
            pi.events.on("pig:tasks:stop", (event) => {
              if (event.sessionId !== sessionId || event.taskId !== task.id) return
              const stopped = { ...task, status: "stopped" }
              pi.events.emit("pig:tasks", { sessionId, tasks: [stopped] })
              pi.sendMessage({ customType: "pig.task", content: "stopped", display: true, details: stopped }, { triggerTurn: false })
            })
          },
        })
      }`,
    )
    const cwd = join(root, "work")
    await mkdir(cwd)
    gateway = new Gateway({ sessionDir: join(root, "sessions"), cwd, agentDir })
    const port = await gateway.start()
    const client = await connect(port)
    const created = await client.request({ command: "create_session", cwd })
    const sessionId = (created as { result: { session: SessionSnapshot } }).result.session.id
    const tasksOf = (message: ServerMessage) =>
      message.type === "event" && message.event.type === "session_snapshot"
        ? message.event.snapshot.tasks
        : undefined

    void client.request({ command: "prompt", sessionId, message: "/bg" })
    await client.next((message) => tasksOf(message)?.[0]?.status === "running")

    // 切走再切回：运行时还是同一个，任务仍在
    await client.request({ command: "detach_session", sessionId })
    await new Promise((resolve) => setTimeout(resolve, 100))
    const back = await client.request({ command: "attach_session", sessionId })

    expect((back as { result: { session: SessionSnapshot } }).result.session.tasks).toMatchObject([
      { id: "bash:t1", status: "running", output: "ready" },
    ])

    await client.request({ command: "stop_task", sessionId, taskId: "bash:t1" })
    await client.next((message) => tasksOf(message)?.[0]?.status === "stopped")

    const history = await fetch(
      `http://127.0.0.1:${port}/api/v1/platform/transcript?sessionId=${sessionId}`,
      { headers: { authorization: gateway.authorizationHeader() } },
    )
    const body = (await history.json()) as { items: Array<{ role: string; task?: unknown }> }

    expect(body.items.filter((item) => item.role === "task")).toMatchObject([
      { task: { id: "bash:t1", status: "stopped" } },
    ])
    client.socket.close()
  }, 30_000)
})
