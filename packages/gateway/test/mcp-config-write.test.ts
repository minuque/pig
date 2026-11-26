import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { patchMcpServer, putMcpServer, removeMcpServer } from "../src/pi/mcp-config-write.js"

let temp: string | undefined

afterEach(async () => {
  if (temp) await rm(temp, { recursive: true, force: true, maxRetries: 5 })
  temp = undefined
})

async function file(content?: string) {
  temp = await mkdtemp(join(tmpdir(), "pig-mcp-write-"))
  const path = join(temp, ".pi", "mcp.json")

  if (content !== undefined) {
    await mkdir(join(temp, ".pi"), { recursive: true })
    await writeFile(path, content)
  }

  return path
}

interface McpJson {
  autoEnableCodemode?: boolean
  extra?: unknown
  mcpServers: Record<string, Record<string, unknown>>
}

const read = async (path: string) => JSON.parse(await readFile(path, "utf8")) as McpJson
const original = `{
    "autoEnableCodemode": false,
    "mcpServers": {
        "fs": { "command": "npx", "args": ["fs"] },
        "docs": { "url": "https://example.com/mcp" }
    },
    "extra": { "keep": true }
}
`

describe("mcp.json 写入", () => {
  it("新增条目时其余内容保留，缩进沿用原文件", async () => {
    const path = await file(original)

    putMcpServer(path, "git", { command: "uvx", args: ["git-mcp"] })
    const text = await readFile(path, "utf8")
    const json = await read(path)

    expect(text).toMatch(/^ {4}"autoEnableCodemode"/m)
    expect(json.autoEnableCodemode).toBe(false)
    expect(json.extra).toEqual({ keep: true })
    expect(Object.keys(json.mcpServers)).toEqual(["fs", "docs", "git"])
  })

  it("文件不存在时创建", async () => {
    const path = await file()

    putMcpServer(path, "fs", { command: "npx" })

    expect((await read(path)).mcpServers).toEqual({ fs: { command: "npx" } })
  })

  it("改名时删旧名写新名", async () => {
    const path = await file(original)

    putMcpServer(path, "files", { command: "npx", args: ["fs"] }, "fs")

    expect(Object.keys((await read(path)).mcpServers)).toEqual(["docs", "files"])
  })

  it("开关与暴露方式回到默认值时删键", async () => {
    const path = await file(original)

    patchMcpServer(path, "fs", { enabled: false, exposure: "direct" })
    expect((await read(path)).mcpServers.fs).toMatchObject({ enabled: false, exposure: "direct" })

    patchMcpServer(path, "fs", { enabled: true, exposure: "codemode" })
    expect((await read(path)).mcpServers.fs).toEqual({ command: "npx", args: ["fs"] })
  })

  it("覆盖条目保留默认值，否则会继承全局的非默认值", async () => {
    const path = await file(`{ "mcpServers": { "docs": { "enabled": false } } }`)

    patchMcpServer(path, "docs", { enabled: true })

    expect((await read(path)).mcpServers.docs).toEqual({ enabled: true })
  })

  it("删除条目，其余不变", async () => {
    const path = await file(original)

    removeMcpServer(path, "docs")
    const json = await read(path)

    expect(Object.keys(json.mcpServers)).toEqual(["fs"])
    expect(json.extra).toEqual({ keep: true })
  })
})
