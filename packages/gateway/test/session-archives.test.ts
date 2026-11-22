import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ClientMessage, ServerMessage, SessionArchives } from "@pig/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"
import type { DirectoryPort } from "../src/system/directory.js"
import { SessionArchivesStore } from "../src/system/session-archives.js"

const runtime = {
  getAvailable: async () => [],
  hasConfiguredAuth: () => false,
  getModel: () => undefined,
}
const directoryPort: DirectoryPort = {
  async selectDirectory() {
    return undefined
  },
  async validateDirectory(path) {
    return path
  },
}
let gateway: Gateway | undefined
let root: string | undefined
const sockets: WebSocket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close()
  await gateway?.stop()
  gateway = undefined

  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 })
  root = undefined
})

async function startGateway() {
  root = await mkdtemp(join(tmpdir(), "pig-archives-"))
  const sessionDir = join(root, "sessions")
  const pigHome = join(root, "pig-home")

  await mkdir(sessionDir)
  gateway = new Gateway({
    platformPort: directoryPort,
    createRuntime: async () => runtime as never,
    createSession: (async () => {
      throw new Error("unexpected createSession")
    }) as never,
    sessionDir,
    pigHome,
  })
  const port = await gateway.start()
  return { base: `http://127.0.0.1:${port}`, port, pigHome }
}

function request(base: string, path: string, method = "GET", body?: unknown): Promise<Response> {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: gateway?.authorizationHeader() ?? "",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function patchArchives(base: string, body: unknown): Promise<SessionArchives> {
  const response = await request(base, "/api/v1/platform/session-archives", "PATCH", body)

  expect(response.status).toBe(200)
  const parsed = (await response.json()) as { archives: SessionArchives }
  return parsed.archives
}

const isArchiveEvent = (message: ServerMessage) =>
  message.type === "event" && message.event.type === "session_archives_changed"

function archivesOf(message: ServerMessage): SessionArchives {
  const event = message.type === "event" ? message.event : undefined

  if (event?.type !== "session_archives_changed") throw new Error("not a session archives event")
  return event.archives
}

interface TestClient {
  next(match: (message: ServerMessage) => boolean, timeoutMs?: number): Promise<ServerMessage>
  take(match: (message: ServerMessage) => boolean): ServerMessage[]
  close(): void
}

async function connect(port: number): Promise<TestClient> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`, {
    headers: { authorization: gateway?.authorizationHeader() ?? "" },
  })
  const inbox: ServerMessage[] = []
  const waiters: Array<() => void> = []

  sockets.push(socket)
  socket.on("message", (data) => {
    inbox.push(JSON.parse(String(data)) as ServerMessage)

    for (const wake of waiters.splice(0)) wake()
  })
  await new Promise((resolveOpen, reject) => socket.once("open", resolveOpen).once("error", reject))

  const take = (match: (message: ServerMessage) => boolean) => {
    const found: ServerMessage[] = []
    const kept: ServerMessage[] = []

    for (const message of inbox.splice(0)) (match(message) ? found : kept).push(message)
    inbox.push(...kept)
    return found
  }

  async function next(
    match: (message: ServerMessage) => boolean,
    timeoutMs = 5000,
  ): Promise<ServerMessage> {
    const deadline = Date.now() + timeoutMs

    for (;;) {
      const index = inbox.findIndex(match)

      if (index >= 0) return inbox.splice(index, 1)[0] as ServerMessage

      const left = deadline - Date.now()

      if (left <= 0) throw new Error("timed out waiting for gateway message")
      await new Promise<void>((resolveWait) => {
        const timer = setTimeout(resolveWait, left)

        waiters.push(() => {
          clearTimeout(timer)
          resolveWait()
        })
      })
    }
  }

  socket.send(JSON.stringify({ type: "hello", version: 1 } satisfies ClientMessage))
  await next((message) => message.type === "hello")
  return { next, take, close: () => socket.close() }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

describe("session-archives 接口", () => {
  it("文件不存在时返回空映射与 exists: false", async () => {
    const { base } = await startGateway()
    const response = await request(base, "/api/v1/platform/session-archives")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ archives: {}, exists: false })
  })

  it("PATCH 原子写入、合并归档并保留已有归档时间戳", async () => {
    const { base, pigHome } = await startGateway()
    const file = join(pigHome, "session-archives.json")

    await writeFile(file, JSON.stringify({ version: 1, archives: { s1: 12345 } }))

    const archived = await patchArchives(base, { archive: ["s1", "s2", "s3"] })

    expect(archived.s1).toBe(12345)
    expect(typeof archived.s2).toBe("number")
    expect(typeof archived.s3).toBe("number")

    const unarchived = await patchArchives(base, { unarchive: ["s2"] })

    expect(unarchived.s1).toBe(12345)
    expect(unarchived.s2).toBeUndefined()
    expect(unarchived.s3).toBeTypeOf("number")

    const saved = JSON.parse(await readFile(file, "utf8")) as {
      version: number
      archives: SessionArchives
    }

    expect(saved.version).toBe(1)
    expect(saved.archives).toEqual(unarchived)
    expect((await readdir(pigHome)).filter((name) => name.endsWith(".tmp"))).toEqual([])
  })

  it("非法请求返回 400 且不落盘", async () => {
    const { base, pigHome } = await startGateway()
    const file = join(pigHome, "session-archives.json")

    expect(
      (await request(base, "/api/v1/platform/session-archives", "PATCH", { unknown: [] })).status,
    ).toBe(400)
    expect(
      (await request(base, "/api/v1/platform/session-archives", "PATCH", { archive: [""] })).status,
    ).toBe(400)
    expect(
      (await request(base, "/api/v1/platform/session-archives", "PATCH", { unarchive: "s1" }))
        .status,
    ).toBe(400)

    await expect(readFile(file, "utf8")).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("损坏的 JSON 返回 409 并保留原文件", async () => {
    const { base, pigHome } = await startGateway()
    const file = join(pigHome, "session-archives.json")
    const contents = "{ broken json"

    await writeFile(file, contents)

    const response = await request(base, "/api/v1/platform/session-archives", "PATCH", {
      archive: ["s1"],
    })

    expect(response.status).toBe(409)
    expect(((await response.json()) as { code: string }).code).toBe("SESSION_ARCHIVES_CORRUPTED")
    expect(await readFile(file, "utf8")).toBe(contents)
  })

  it("remove 会清掉被删除会话的归档条目且不额外建空文件", async () => {
    root = await mkdtemp(join(tmpdir(), "pig-archives-store-"))
    const file = join(root, "session-archives.json")
    const store = new SessionArchivesStore(file)

    await store.remove("missing")
    await expect(readFile(file, "utf8")).rejects.toMatchObject({ code: "ENOENT" })

    await store.patch({ archive: ["s1", "s2"] })
    await store.remove("s1")
    const after = await store.read()

    expect(after.exists).toBe(true)
    expect(Object.keys(after.archives)).toEqual(["s2"])
    store.close()
  })
})

describe("session-archives 同步", () => {
  it("自身写入只推送一次，外部原子替换与多客户端都能实时收到更新", async () => {
    const { base, port, pigHome } = await startGateway()
    const file = join(pigHome, "session-archives.json")
    const first = await connect(port)
    const second = await connect(port)
    const updated = await patchArchives(base, { archive: ["s1"] })

    expect(archivesOf(await first.next(isArchiveEvent))).toEqual(updated)
    expect(archivesOf(await second.next(isArchiveEvent))).toEqual(updated)

    await sleep(300)
    expect(first.take(isArchiveEvent)).toEqual([])

    const temp = join(pigHome, "replace.tmp")

    await writeFile(temp, JSON.stringify({ version: 1, archives: { s9: 999 } }))
    await rename(temp, file)

    expect(archivesOf(await first.next(isArchiveEvent))).toEqual({ s9: 999 })
    first.close()
    second.close()
  })
})
