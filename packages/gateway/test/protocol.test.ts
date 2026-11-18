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

describe("Pi 配置目录：给了 agentDir 就只读那里的模型与凭据", () => {
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR

  afterEach(() => {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir
  })

  /** 一份 Pi 配置：一个 provider、一个模型、一把 key。 */
  async function piConfig(dir: string, provider: string) {
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, "models.json"),
      JSON.stringify({
        providers: {
          [provider]: {
            baseUrl: "http://127.0.0.1:9/v1",
            api: "openai-completions",
            apiKey: "key",
            models: [{ id: `${provider}-model` }],
          },
        },
      }),
    )
    await writeFile(join(dir, "auth.json"), JSON.stringify({}))
  }

  it("新会话用 agentDir 里的模型，不用本机默认配置目录里的", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-agent-dir-"))
    // 本机默认目录里有另一份配置：不该被读到
    process.env.PI_CODING_AGENT_DIR = join(root, "home-pi")
    await piConfig(join(root, "home-pi"), "home")
    await piConfig(join(root, "agent"), "isolated")
    const cwd = join(root, "work")
    await mkdir(cwd)
    gateway = new Gateway({
      sessionDir: join(root, "sessions"),
      cwd,
      agentDir: join(root, "agent"),
    })
    const port = await gateway.start()
    const client = await connect(port)
    const created = await client.request({ command: "create_session", cwd })

    expect(
      (created as { result: { session: SessionSnapshot } }).result.session.model,
    ).toMatchObject({ provider: "isolated" })
    client.socket.close()
  }, 30_000)
})
