import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { ServerMessageDecoder } from "@earendil-works/pi-protocol"
import { WebSocket } from "ws"

import Gateway from "../src/index.js"
import type { DirectoryPort } from "../src/directory.js"

let selectedDirectory: string | undefined
const directoryPort: DirectoryPort = {
  async selectDirectory() {
    return selectedDirectory
  },
  async validateDirectory(path) {
    return path
  },
}
let gateway: Gateway | undefined
let sessionDir: string | undefined

afterEach(async () => {
  selectedDirectory = undefined
  await gateway?.stop()
  gateway = undefined

  if (sessionDir) await rm(sessionDir, { recursive: true, force: true })
  sessionDir = undefined
})

const idleRuntime = {
  getAvailable: async () => [],
  hasConfiguredAuth: () => false,
  getModel: () => undefined,
}

async function startGateway(options?: ConstructorParameters<typeof Gateway>[0]) {
  sessionDir = await mkdtemp(join(tmpdir(), "pig-host-"))
  gateway = new Gateway({
    platformPort: directoryPort,
    createRuntime: async () => idleRuntime as never,
    sessionDir,
    ...options,
  })
  return `http://127.0.0.1:${await gateway.start()}`
}

async function request(
  base: string,
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  return fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe("thin host HTTP shell", () => {
  it("start 不等待模型目录预热", async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const base = await startGateway({
      createRuntime: async () => {
        await gate
        return idleRuntime as never
      },
    })

    expect((await request(base, "/health")).status).toBe(200)
    release()
  })

  it("selects a directory", async () => {
    const base = await startGateway()
    selectedDirectory = "C:/projects/demo"
    expect(
      await (await request(base, "/api/v1/platform/select-directory", undefined, "POST")).json(),
    ).toEqual({
      path: "C:/projects/demo",
      requiresManualInput: false,
    })

    selectedDirectory = undefined
    expect(
      await (await request(base, "/api/v1/platform/select-directory", undefined, "POST")).json(),
    ).toEqual({
      path: null,
      requiresManualInput: false,
    })
  })

  it("renames and deletes sessions", async () => {
    const base = await startGateway()
    expect(
      (await request(base, "/api/v1/platform/rename-session", { id: "missing", name: "a" })).status,
    ).toBe(404)
    expect((await request(base, "/api/v1/platform/context-usage")).status).toBe(400)
    expect(
      (await request(base, "/api/v1/platform/context-usage?sessionId=missing&preview=nope")).status,
    ).toBe(400)
    await expect(
      (await request(base, "/api/v1/platform/context-usage?sessionId=missing")).json(),
    ).resolves.toEqual({ usage: null, preview: null })
    const cards = await request(base, "/api/v1/platform/session-cards")
    expect(cards.status).toBe(200)
    await expect(cards.json()).resolves.toMatchObject({ cards: expect.any(Array) })
    expect((await request(base, "/api/v1/platform/transcript")).status).toBe(400)
    expect((await request(base, "/api/v1/platform/transcript?sessionId=missing")).status).toBe(404)
  }, 15_000)
})

describe("thin host WebSocket", () => {
  it("rejects upgrades on unknown paths", async () => {
    const base = await startGateway()
    const port = new URL(base).port
    const status = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("upgrade 未返回 unexpected-response")), 3000)
      const socket = new WebSocket(`ws://127.0.0.1:${port}/nope`)
      socket.once("unexpected-response", (_req, res) => {
        clearTimeout(timer)
        socket.terminate()
        resolve(res.statusCode ?? 0)
      })
      socket.once("error", () => {
        // unexpected-response 后底层 socket 被销毁也会触发 error，忽略
      })
    })

    expect(status).toBe(404)
  })

  it("hands connections to PiServer after upgrade", async () => {
    const base = await startGateway()
    const port = new URL(base).port
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/pi`)
    const result = await new Promise<{ message: unknown; closed: boolean }>((resolve, reject) => {
      const decoder = new ServerMessageDecoder()
      socket.on("message", (data) => {
        const messages = decoder.push(data as Buffer)

        for (const message of messages) {
          if (message.type === "hello_error") {
            socket.close()
            resolve({ message, closed: false })
          }
        }
      })
      socket.once("close", () => resolve({ message: undefined, closed: true }))
      socket.once("error", reject)
      socket.once("open", () => socket.send(new Uint8Array([0x00, 0x00, 0x00, 0x01, 0xff])))
    })
    const message = result.message as { type: string; error?: { code: string } }
    expect(message.type).toBe("hello_error")
    expect(message.error?.code).toBe("invalid_request")
    expect(result.closed).toBe(false)
  })
})
