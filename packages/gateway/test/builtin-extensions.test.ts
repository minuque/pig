import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent"
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
  type FauxResponseStep,
} from "@earendil-works/pi-ai/providers/faux"
import type { Command, ServerMessage } from "@pig/protocol"
import { afterAll, beforeAll, expect, it } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"

type Response = Extract<ServerMessage, { type: "response" }>

type Context = Parameters<Extract<FauxResponseStep, (...args: never[]) => unknown>>[0]

const faux = fauxProvider({ api: "faux", provider: "faux", models: [{ id: "faux-1" }] })
let root: string
let workspace: string
let sessionDir: string
let gateway: Gateway
let socket: WebSocket
let seq = 0
const pending = new Map<string, (message: Response) => void>()

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "pig-builtin-")))
  workspace = join(root, "workspace")
  sessionDir = join(root, "sessions")
  await mkdir(workspace)
  await mkdir(sessionDir)
  await writeFile(join(workspace, "notes.md"), "笔记正文\n")
  await writeFile(join(workspace, "extra.md"), "补充正文\n")
  const runtime = await ModelRuntime.create({ allowModelNetwork: false })
  runtime.registerNativeProvider(faux.provider)
  gateway = new Gateway({ sessionDir, cwd: workspace, port: 0, createRuntime: async () => runtime })
  const port = await gateway.start()
  socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization: gateway.authorizationHeader() },
  })
  socket.on("message", (data) => {
    const message = JSON.parse(String(data)) as ServerMessage

    if (message.type === "response") pending.get(message.id)?.(message)
  })
  await new Promise((resolve) => socket.once("open", resolve))
  await new Promise<void>((resolve) => {
    socket.once("message", () => resolve())
    socket.send(JSON.stringify({ type: "hello", version: 1 }))
  })
})

afterAll(async () => {
  socket.close()
  await gateway.stop()
  await rm(root, { recursive: true, force: true, maxRetries: 5 })
})

function request(command: Command): Promise<Response> {
  const id = `t-${(seq += 1)}`
  return new Promise((resolve) => {
    pending.set(id, resolve)
    socket.send(JSON.stringify({ type: "request", id, command }))
  })
}

async function createSession() {
  const reply = await request({
    command: "create_session",
    cwd: workspace,
    model: { provider: "faux", id: "faux-1" },
  })

  if (!reply.ok || !("session" in reply.result)) throw new Error("建会话失败")
  return reply.result.session.id
}

async function sessionEntries(sessionId: string) {
  const files = (await readdir(sessionDir, { recursive: true })).filter((name) =>
    name.includes(sessionId),
  )
  return SessionManager.open(join(sessionDir, files[0]!)).getEntries()
}

/** 会话文件里的计时条目与用户消息。 */
async function persisted(sessionId: string) {
  const entries = await sessionEntries(sessionId)
  return {
    users: entries.flatMap((entry) =>
      entry.type === "message" && entry.message.role === "user" ? [entry] : [],
    ),
    timings: entries.flatMap((entry) =>
      entry.type === "custom" && entry.customType === "pig.turn-timing"
        ? [entry.data as { userId: string; startedAt: number; outcome: string }]
        : [],
    ),
  }
}

const userTexts = (context: Context) =>
  context.messages.flatMap((message) =>
    message.role === "user"
      ? [
          typeof message.content === "string"
            ? message.content
            : message.content.map((part) => (part.type === "text" ? part.text : "")).join(""),
        ]
      : [],
  )

it("一次 prompt：会话文件里一条 running 一条 complete，userId 指向用户消息，计时从收到输入起", async () => {
  faux.setResponses([fauxAssistantMessage("好")])
  const sessionId = await createSession()
  const sentAt = Date.now()
  expect((await request({ command: "prompt", sessionId, message: "你好" })).ok).toBe(true)

  const { users, timings } = await persisted(sessionId)
  expect(users).toHaveLength(1)
  expect(timings.map((timing) => timing.outcome)).toEqual(["running", "complete"])
  expect(timings.every((timing) => timing.userId === users[0]!.id)).toBe(true)
  expect(timings[0]!.startedAt).toBeGreaterThanOrEqual(sentAt)
  expect(timings[0]!.startedAt).toBeLessThanOrEqual(users[0]!.message.timestamp)
})

it("模型报错记 error，中止记 aborted", async () => {
  faux.setResponses([fauxAssistantMessage([], { stopReason: "error", errorMessage: "bad input" })])
  const failed = await createSession()
  await request({ command: "prompt", sessionId: failed, message: "出错" })
  expect((await persisted(failed)).timings.at(-1)?.outcome).toBe("error")

  let called = () => {}
  const waiting = new Promise<void>((resolve) => (called = resolve))
  faux.setResponses([
    async (_context, options) => {
      called()
      await new Promise((resolve) => options?.signal?.addEventListener("abort", resolve))
      return fauxAssistantMessage("迟到")
    },
  ])
  const aborted = await createSession()
  const prompt = request({ command: "prompt", sessionId: aborted, message: "停下" })
  await waiting
  await request({ command: "abort", sessionId: aborted })
  await prompt
  expect((await persisted(aborted)).timings.map((timing) => timing.outcome)).toEqual([
    "running",
    "aborted",
  ])
})

it("回合进行中关掉网关：计时落一条 aborted 终态，不停在 running", async () => {
  const runtime = await ModelRuntime.create({ allowModelNetwork: false })
  runtime.registerNativeProvider(faux.provider)

  const other = new Gateway({
    sessionDir,
    cwd: workspace,
    port: 0,
    createRuntime: async () => runtime,
  })
  const port = await other.start()
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization: other.authorizationHeader() },
  })
  const replies = new Map<string, (message: Response) => void>()
  ws.on("message", (data) => {
    const message = JSON.parse(String(data)) as ServerMessage

    if (message.type === "response") replies.get(message.id)?.(message)
  })
  await new Promise((resolve) => ws.once("open", resolve))
  await new Promise<void>((resolve) => {
    ws.once("message", () => resolve())
    ws.send(JSON.stringify({ type: "hello", version: 1 }))
  })

  const send = (id: string, command: Command) =>
    new Promise<Response>((resolve) => {
      replies.set(id, resolve)
      ws.send(JSON.stringify({ type: "request", id, command }))
    })
  let called = () => {}
  const waiting = new Promise<void>((resolve) => (called = resolve))
  faux.setResponses([
    async (_context, options) => {
      called()
      await new Promise((resolve) => options?.signal?.addEventListener("abort", resolve))
      return fauxAssistantMessage("迟到")
    },
  ])

  const created = await send("c", {
    command: "create_session",
    cwd: workspace,
    model: { provider: "faux", id: "faux-1" },
  })

  if (!created.ok || !("session" in created.result)) throw new Error("建会话失败")
  const sessionId = created.result.session.id
  void send("p", { command: "prompt", sessionId, message: "关窗" })
  await waiting
  ws.close()
  await other.stop()

  expect((await persisted(sessionId)).timings.map((timing) => timing.outcome)).toEqual([
    "running",
    "aborted",
  ])
})

it("prompt 与运行中 steer 里的 @file，模型收到 <file> 块", async () => {
  const seen: string[][] = []
  let called = () => {}
  let release = () => {}
  const waiting = new Promise<void>((resolve) => (called = resolve))
  const gate = new Promise<void>((resolve) => (release = resolve))
  faux.setResponses([
    async (context) => {
      seen.push(userTexts(context))
      called()
      await gate
      return fauxAssistantMessage(fauxToolCall("read", { path: "notes.md" }), {
        stopReason: "toolUse",
      })
    },
    (context) => {
      seen.push(userTexts(context))
      return fauxAssistantMessage(fauxText("读完了"))
    },
  ])
  const sessionId = await createSession()
  const prompt = request({ command: "prompt", sessionId, message: "看 @notes.md" })
  await waiting
  expect((await request({ command: "steer", sessionId, message: "再看 @extra.md" })).ok).toBe(true)
  release()
  await prompt

  expect(seen[0]?.[0]).toContain(`<file name="${join(workspace, "notes.md")}">\n笔记正文`)
  expect(seen[1]?.at(-1)).toContain(`<file name="${join(workspace, "extra.md")}">\n补充正文`)
})
