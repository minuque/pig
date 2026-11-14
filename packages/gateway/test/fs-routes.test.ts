import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import Gateway from "../src/index.js"

let gateway: Gateway | undefined
let sessionDir: string
let workspace: string
let outside: string
let base: string

beforeEach(async () => {
  sessionDir = await mkdtemp(join(tmpdir(), "pig-fs-session-"))
  workspace = await mkdtemp(join(tmpdir(), "pig-fs-ws-"))
  outside = await mkdtemp(join(tmpdir(), "pig-fs-outside-"))
  await mkdir(join(workspace, "src"))
  await writeFile(join(workspace, "src", "main.ts"), "export const answer = 42\n")
  await writeFile(join(workspace, "logo.bin"), Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02, 0x03]))
  await writeFile(join(workspace, "big.txt"), "x".repeat(1024 * 1024 + 1))
  await writeFile(join(outside, "secret.txt"), "secret")
  gateway = new Gateway({
    platformPort: {
      selectDirectory: async () => workspace,
      validateDirectory: async (path) => path,
    },
    createRuntime: async () =>
      ({
        getAvailable: async () => [],
        hasConfiguredAuth: () => false,
        getModel: () => undefined,
      }) as never,
    sessionDir,
  })
  base = `http://127.0.0.1:${await gateway.start()}`
  await get("/api/v1/platform/select-directory", { method: "POST" })
})

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined

  for (const dir of [sessionDir, workspace, outside])
    await rm(dir, { recursive: true, force: true, maxRetries: 5 })
})

function get(path: string, init?: RequestInit & { headers?: Record<string, string> }) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { authorization: gateway?.authorizationHeader() ?? "", ...init?.headers },
  })
}

const fsUrl = (kind: string, path: string, cwd = workspace) =>
  `/api/v1/platform/fs/${kind}?${new URLSearchParams({ cwd, path }).toString()}`

describe("fs routes", () => {
  it("未授权的工作区一律 403", async () => {
    for (const kind of ["stat", "text", "raw"])
      expect((await get(fsUrl(kind, "secret.txt", outside))).status).toBe(403)
  })

  it("越出工作区根的路径 403", async () => {
    const escape = `../${outside.split(/[\\/]/).pop()}/secret.txt`

    for (const kind of ["stat", "text", "raw"])
      expect((await get(fsUrl(kind, escape))).status).toBe(403)
    expect((await get(fsUrl("text", join(outside, "secret.txt")))).status).toBe(403)
  })

  it("stat 返回类型与大小，不存在 404", async () => {
    const response = await get(fsUrl("stat", "src/main.ts"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ kind: "file", size: 25 })
    expect((await get(fsUrl("stat", "src/none.ts"))).status).toBe(404)
  })

  it("text 读出文本；二进制与超限只给分类", async () => {
    await expect((await get(fsUrl("text", "src/main.ts"))).json()).resolves.toEqual({
      content: "export const answer = 42\n",
      size: 25,
      binary: false,
      tooLarge: false,
    })
    await expect((await get(fsUrl("text", "logo.bin"))).json()).resolves.toEqual({
      size: 6,
      binary: true,
      tooLarge: false,
    })
    await expect((await get(fsUrl("text", "big.txt"))).json()).resolves.toEqual({
      size: 1024 * 1024 + 1,
      binary: false,
      tooLarge: true,
    })
  })

  it("text 带 force 时二进制也按文本读出", async () => {
    const body = (await (await get(`${fsUrl("text", "logo.bin")}&force=1`)).json()) as {
      content?: string
    }

    expect(typeof body.content).toBe("string")
  })

  it("raw 输出原始字节并支持 Range", async () => {
    const whole = await get(fsUrl("raw", "logo.bin"))

    expect(whole.status).toBe(200)
    expect(whole.headers.get("accept-ranges")).toBe("bytes")
    expect(Buffer.from(await whole.arrayBuffer())).toEqual(
      Buffer.from([0x89, 0x50, 0x00, 0x01, 0x02, 0x03]),
    )

    const part = await get(fsUrl("raw", "logo.bin"), { headers: { range: "bytes=2-3" } })

    expect(part.status).toBe(206)
    expect(part.headers.get("content-range")).toBe("bytes 2-3/6")
    expect(Buffer.from(await part.arrayBuffer())).toEqual(Buffer.from([0x00, 0x01]))

    const open = await get(fsUrl("raw", "logo.bin"), { headers: { range: "bytes=4-" } })

    expect(open.status).toBe(206)
    expect(Buffer.from(await open.arrayBuffer())).toEqual(Buffer.from([0x02, 0x03]))
    expect((await get(fsUrl("raw", "logo.bin"), { headers: { range: "bytes=9-" } })).status).toBe(
      416,
    )
  })

  it("raw 按扩展名给 Content-Type", async () => {
    await writeFile(join(workspace, "a.png"), Buffer.from([1]))

    expect((await get(fsUrl("raw", "a.png"))).headers.get("content-type")).toBe("image/png")
  })
})
