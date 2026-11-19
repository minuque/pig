import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createEventBus, SessionManager } from "@earendil-works/pi-coding-agent"
import type { ServerMessage, ServerSnapshot } from "@pig/protocol"
import { afterEach, describe, expect, it, vi } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"
import { PiHostService } from "../src/pi/service.js"

const provider = { id: "acme", name: "Acme", auth: {}, getModels: () => [] }
/** 供应商目录可控：改 available 就能让下一次快照的模型列表不同。 */
let available: unknown[] = []
const runtime = {
  getProviders: () => [provider],
  getProvider: (id: string) => (id === provider.id ? provider : undefined),
  getProviderAuthStatus: () => ({ configured: false }),
  getAvailable: async () => available,
  hasConfiguredAuth: () => false,
  getModel: () => undefined,
  refresh: async () => ({ aborted: false, errors: new Map() }),
  logout: async () => undefined,
}
let gateway: Gateway | undefined
let root: string | undefined

afterEach(async () => {
  available = []
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

/** 已握手的连接：按谓词等协议消息。 */
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

  socket.send(JSON.stringify({ type: "hello", version: 1 }))
  await next((message) => message.type === "hello")

  const snapshot = async (match: (snapshot: ServerSnapshot) => boolean) => {
    const message = await next(
      (item) =>
        item.type === "event" &&
        item.event.type === "server_snapshot" &&
        match(item.event.snapshot),
    )

    if (message.type !== "event" || message.event.type !== "server_snapshot")
      throw new Error("expected a server snapshot")
    return message.event.snapshot
  }

  return { socket, next, snapshot }
}

describe("HTTP 写操作广播服务快照", () => {
  it("供应商配置变了：派发 pig:models:changed 给扩展，并通知 Gateway", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-snapshot-"))
    const events = createEventBus()
    const changed: unknown[] = []
    const onCatalogChange = vi.fn()

    events.on("pig:models:changed", (data) => changed.push(data))

    const host = new PiHostService({
      agentDir: join(root, "agent"),
      createRuntime: async () => runtime as never,
      events,
    })

    host.onCatalogChange = onCatalogChange
    await host.providers.logout("acme")

    expect(changed).toHaveLength(1)
    expect(onCatalogChange).toHaveBeenCalledTimes(1)
    await host.dispose()
  })

  it("重命名、删除会话与刷新供应商都推 server_snapshot", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-snapshot-"))
    const cwd = join(root, "work")
    const sessionDir = join(root, "sessions")

    await mkdir(cwd)
    SessionManager.create(cwd, sessionDir, { id: "s-1" }).appendMessage({
      role: "user",
      content: "第一句",
      timestamp: 1000,
    })
    gateway = new Gateway({
      sessionDir,
      cwd,
      agentDir: join(root, "agent"),
      createRuntime: async () => runtime as never,
    })

    const base = `http://127.0.0.1:${await gateway.start()}`
    const { socket, snapshot } = await connect(Number(new URL(base).port))
    const write = async (path: string, body?: unknown) => {
      const response = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          authorization: gateway?.authorizationHeader() ?? "",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })

      expect(response.status).toBe(200)
    }

    await write("/api/v1/platform/rename-session", { id: "s-1", name: "新名字" })
    const renamed = await snapshot((item) => item.sessions[0]?.sessionName === "新名字")
    expect(renamed.sessions.map((session) => session.id)).toEqual(["s-1"])

    await write("/api/v1/platform/delete-session", { id: "s-1" })
    const deleted = await snapshot((item) => item.sessions.length === 0)
    expect(deleted.sessions).toEqual([])

    available = [
      {
        provider: "acme",
        id: "acme-1",
        name: "Acme 1",
        api: "openai-completions",
        reasoning: false,
        input: ["text"],
        contextWindow: 1000,
        maxTokens: 100,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      },
    ]
    await write("/api/v1/platform/providers/refresh")
    const refreshed = await snapshot((item) => item.models.length === 1)
    expect(refreshed.models.map((model) => model.id)).toEqual(["acme-1"])

    socket.close()
  }, 15_000)
})
