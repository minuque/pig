import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { defaultPigHome } from "@pig/environment"
import type { ClientMessage, ServerMessage, UserPreferences } from "@pig/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"
import type { DirectoryPort } from "../src/system/directory.js"

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
const DEFAULT_BODY = {
  theme: "auto",
  themePreset: "linear",
  welcomeField: "mask",
  uiFont: "",
  codeFont: "",
  uiSize: "m",
  codeSize: 13,
  locale: "zh-CN",
  chatWidth: "comfortable",
  notify: true,
  userName: "",
  clickSound: true,
  favoriteModels: [],
  railLayout: { closed: [], hidden: [] },
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
  root = await mkdtemp(join(tmpdir(), "pig-preferences-"))
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

async function patchPreferences(base: string, body: unknown): Promise<UserPreferences> {
  const response = await request(base, "/api/v1/platform/preferences", "PATCH", body)

  expect(response.status).toBe(200)
  const parsed = (await response.json()) as { preferences: UserPreferences }
  return parsed.preferences
}

const isPreferenceEvent = (message: ServerMessage) =>
  message.type === "event" && message.event.type === "preferences_changed"

function preferencesOf(message: ServerMessage): UserPreferences {
  const event = message.type === "event" ? message.event : undefined

  if (event?.type !== "preferences_changed") throw new Error("not a preferences event")
  return event.preferences
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

describe("defaultPigHome", () => {
  it("默认落到 ~/.pig，设置 PIG_HOME 后以它为根", () => {
    const custom = join(tmpdir(), "pig-home-custom")

    expect(defaultPigHome({})).toBe(join(homedir(), ".pig"))
    expect(defaultPigHome({ PIG_HOME: custom })).toBe(resolve(custom))
    expect(defaultPigHome({ PIG_HOME: "   " })).toBe(join(homedir(), ".pig"))
  })
})

describe("preferences 接口", () => {
  it("文件不存在时返回默认值与 exists: false", async () => {
    const { base } = await startGateway()
    const response = await request(base, "/api/v1/platform/preferences")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ preferences: DEFAULT_BODY, exists: false })
  })

  it("PATCH 原子写入、合并字段并保留磁盘上的未知字段", async () => {
    const { base, pigHome } = await startGateway()
    const file = join(pigHome, "preferences.json")

    await writeFile(file, JSON.stringify({ theme: "dark", unknownTop: { keep: true } }))

    const preferences = await patchPreferences(base, {
      locale: "en",
      userName: "  小猪  ",
      favoriteModels: ["anthropic/claude", "invalid", "anthropic/claude"],
    })

    expect(preferences.locale).toBe("en")
    expect(preferences.userName).toBe("小猪")
    expect(preferences.favoriteModels).toEqual(["anthropic/claude"])
    expect(preferences.theme).toBe("dark")

    const saved = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>

    expect(saved.unknownTop).toEqual({ keep: true })
    expect(saved.theme).toBe("dark")
    expect(saved.locale).toBe("en")
    expect(saved.userName).toBe("小猪")
    expect((await readdir(pigHome)).filter((name) => name.endsWith(".tmp"))).toEqual([])
  })

  it("未知字段与非法取值返回 400，且不落盘", async () => {
    const { base, pigHome } = await startGateway()
    const file = join(pigHome, "preferences.json")
    const unknown = await request(base, "/api/v1/platform/preferences", "PATCH", { nope: 1 })

    expect(unknown.status).toBe(400)
    expect(((await unknown.json()) as { code: string }).code).toBe("INVALID_REQUEST")

    expect(
      (await request(base, "/api/v1/platform/preferences", "PATCH", { theme: "blue" })).status,
    ).toBe(400)
    expect(
      (await request(base, "/api/v1/platform/preferences", "PATCH", { codeSize: 17 })).status,
    ).toBe(400)
    await expect(readFile(file, "utf8")).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("损坏的 JSON 拒绝覆写并保留原文件", async () => {
    const { base, pigHome } = await startGateway()
    const file = join(pigHome, "preferences.json")
    const contents = "{ not json"

    await writeFile(file, contents)

    const response = await request(base, "/api/v1/platform/preferences", "PATCH", {
      theme: "dark",
    })

    expect(response.status).toBe(409)
    expect(((await response.json()) as { code: string }).code).toBe("PREFERENCES_CORRUPTED")
    expect(await readFile(file, "utf8")).toBe(contents)
  })
})

describe("preferences 同步", () => {
  it("自身写入只推送一次，外部原子替换后再推送新值", async () => {
    const { base, port, pigHome } = await startGateway()
    const file = join(pigHome, "preferences.json")
    const client = await connect(port)

    await patchPreferences(base, { theme: "dark" })
    expect(preferencesOf(await client.next(isPreferenceEvent)).theme).toBe("dark")

    await sleep(300)
    expect(client.take(isPreferenceEvent)).toEqual([])

    const temp = join(pigHome, "replace.tmp")

    await writeFile(temp, JSON.stringify({ theme: "light", locale: "en" }))
    await rename(temp, file)

    const external = preferencesOf(await client.next(isPreferenceEvent))

    expect(external.theme).toBe("light")
    expect(external.locale).toBe("en")
    client.close()
  })

  it("客户端 A 写入后客户端 B 收到 preferences_changed", async () => {
    const { base, port } = await startGateway()
    const first = await connect(port)
    const second = await connect(port)

    await patchPreferences(base, { chatWidth: "wide" })

    expect(preferencesOf(await first.next(isPreferenceEvent)).chatWidth).toBe("wide")
    expect(preferencesOf(await second.next(isPreferenceEvent)).chatWidth).toBe("wide")
    first.close()
    second.close()
  })
})
