import { mkdtemp, rm } from "node:fs/promises"
import type { FSWatcher, WatchListener } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { ClientMessage, Command, ServerMessage } from "@pig/protocol"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"
import { SessionFileWatcher } from "../src/pi/session-watcher.js"

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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let root: string | undefined
let gateway: Gateway | undefined
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close()
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

function fakeWatchDir() {
  const active = new Set<(event: string, filename: string) => void>()
  const watchDir = ((_dir: string, listener: WatchListener<string>) => {
    const fn = listener as (event: string, filename: string) => void
    active.add(fn)

    const watcher = {
      on: () => watcher,
      unref: () => watcher,
      close: () => {
        active.delete(fn)
      },
    }
    return watcher as unknown as FSWatcher
  }) as unknown as typeof import("node:fs").watch
  const emit = (filename: string, event = "change") => {
    for (const fn of [...active]) fn(event, filename)
  }

  return { watchDir, active, emit }
}

describe("会话文件监听：按需开关", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("没有订阅者不开 watcher，最后一个退订就关", async () => {
    const { watchDir, active, emit } = fakeWatchDir()
    const changes: number[] = []
    const watcher = new SessionFileWatcher({
      resolvePath: async () => "/tmp/sessions/s-1.jsonl",
      debounceMs: 20,
      watchDir,
    })

    expect(active.size).toBe(0)
    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(100)
    expect(changes).toEqual([])

    const stop = watcher.subscribe("s-1", () => changes.push(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(active.size).toBe(1)

    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(20)
    expect(changes).toHaveLength(1)

    stop()
    expect(active.size).toBe(0)
    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(100)
    expect(changes).toHaveLength(1)
    watcher.close()
  })

  it("同一会话多订阅者共用一份监听，退订一个不影响另一个", async () => {
    const { watchDir, active, emit } = fakeWatchDir()
    const first: number[] = []
    const second: number[] = []
    const watcher = new SessionFileWatcher({
      resolvePath: async () => "/tmp/sessions/s-1.jsonl",
      debounceMs: 20,
      watchDir,
    })
    const stopFirst = watcher.subscribe("s-1", () => first.push(1))

    watcher.subscribe("s-1", () => second.push(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(active.size).toBe(1)

    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(20)
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)

    stopFirst()
    expect(active.size).toBe(1)
    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(20)
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(2)
    watcher.close()
  })

  it("高频写入在防抖窗口里合并成一次通知，别的文件不触发", async () => {
    const { watchDir, emit } = fakeWatchDir()
    const changes: number[] = []
    const watcher = new SessionFileWatcher({
      resolvePath: async () => "/tmp/sessions/s-1.jsonl",
      debounceMs: 200,
      watchDir,
    })

    watcher.subscribe("s-1", () => changes.push(1))
    await vi.advanceTimersByTimeAsync(0)
    emit("other.jsonl")

    for (let index = 0; index < 5; index += 1) emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(199)
    expect(changes).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(changes).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(400)
    expect(changes).toHaveLength(1)
    watcher.close()
  })

  it("close 之后不再通知", async () => {
    const { watchDir, active, emit } = fakeWatchDir()
    const changes: number[] = []
    const watcher = new SessionFileWatcher({
      resolvePath: async () => "/tmp/sessions/s-1.jsonl",
      debounceMs: 20,
      watchDir,
    })

    watcher.subscribe("s-1", () => changes.push(1))
    await vi.advanceTimersByTimeAsync(0)
    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(20)
    expect(changes).toHaveLength(1)

    watcher.close()
    expect(active.size).toBe(0)
    emit("s-1.jsonl")
    await vi.advanceTimersByTimeAsync(100)
    expect(changes).toHaveLength(1)
  })

  it("会话不在磁盘上就没有可监听的文件", async () => {
    const { watchDir, active } = fakeWatchDir()
    const changes: number[] = []
    const watcher = new SessionFileWatcher({
      resolvePath: async () => undefined,
      watchDir,
    })

    watcher.subscribe("missing", () => changes.push(1))
    await vi.advanceTimersByTimeAsync(100)
    expect(active.size).toBe(0)
    expect(changes).toEqual([])
    watcher.close()
  })
})

describe("pig 协议：watch_session 跟随外部追加", () => {
  async function start() {
    root = await mkdtemp(join(tmpdir(), "pig-watch-protocol-"))
    const sessionDir = join(root, "sessions")
    const manager = SessionManager.create(join(root, "work"), sessionDir, { id: "s-1" })

    manager.appendModelChange("test", "test-model")
    manager.appendMessage({ role: "user", content: "第一句", timestamp: 1000 })
    const path = manager.getSessionFile()

    if (!path) throw new Error("session file is missing")
    gateway = new Gateway({ sessionDir, cwd: root, createRuntime: async () => runtime as never })
    const port = await gateway.start()
    return { path, port }
  }

  async function connect(port: number) {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
      headers: { authorization: gateway?.authorizationHeader() ?? "" },
    })

    sockets.push(socket)
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
    const has = (match: (message: ServerMessage) => boolean) => inbox.some(match)
    let seq = 0
    const request = async (command: Command) => {
      const id = `r${(seq += 1)}`

      socket.send(JSON.stringify({ type: "request", id, command } satisfies ClientMessage))
      return next((message) => message.type === "response" && message.id === id)
    }

    socket.send(JSON.stringify({ type: "hello", version: 1 } satisfies ClientMessage))
    await next((message) => message.type === "hello")
    return { socket, request, next, has }
  }

  const fileChanged = (message: ServerMessage) =>
    message.type === "event" && message.event.type === "session_file_changed"

  function appendExternal(path: string, text: string) {
    SessionManager.open(path).appendMessage({ role: "user", content: text, timestamp: 2_000 })
  }

  it("未挂会话的连接 watch 后，外部追加推送事件；unwatch 后不再推", async () => {
    const { path, port } = await start()
    const client = await connect(port)
    const watched = await client.request({ command: "watch_session", sessionId: "s-1" })
    expect(watched.type === "response" && watched.ok).toBe(true)

    appendExternal(path, "外部追加")
    const event = await client.next(fileChanged)
    expect(event).toMatchObject({ event: { type: "session_file_changed", sessionId: "s-1" } })

    expect((await client.request({ command: "unwatch_session", sessionId: "s-1" })).type).toBe(
      "response",
    )
    await sleep(100)
    appendExternal(path, "再追加")
    await sleep(400)
    expect(client.has(fileChanged)).toBe(false)
  })

  it("两条连接看同一会话都收到；一条断开后另一条照旧", async () => {
    const { path, port } = await start()
    const first = await connect(port)
    const second = await connect(port)

    await first.request({ command: "watch_session", sessionId: "s-1" })
    await second.request({ command: "watch_session", sessionId: "s-1" })

    appendExternal(path, "第一句追加")
    expect(await first.next(fileChanged)).toBeTruthy()
    expect(await second.next(fileChanged)).toBeTruthy()
    await sleep(200)
    expect(first.has(fileChanged)).toBe(false)
    expect(second.has(fileChanged)).toBe(false)

    first.socket.close()
    await sleep(200)
    appendExternal(path, "第二句追加")
    expect(await second.next(fileChanged)).toBeTruthy()
  })
})
