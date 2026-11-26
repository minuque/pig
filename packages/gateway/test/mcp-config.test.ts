import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { readMcpScope } from "../src/pi/mcp-config.js"

let temp: string | undefined

afterEach(async () => {
  if (temp) await rm(temp, { recursive: true, force: true, maxRetries: 5 })
  temp = undefined
})

async function setup(global: unknown, project?: unknown) {
  temp = await mkdtemp(join(tmpdir(), "pig-mcp-config-"))
  const agentDir = join(temp, "agent")
  const workspace = join(temp, "ws")

  await mkdir(agentDir, { recursive: true })
  await mkdir(join(workspace, ".pi"), { recursive: true })
  await writeFile(join(agentDir, "mcp.json"), JSON.stringify(global, null, 2))

  if (project !== undefined)
    await writeFile(join(workspace, ".pi", "mcp.json"), JSON.stringify(project, null, 2))
  return { agentDir, workspace }
}

const fs = { command: "npx", args: ["-y", "server-filesystem", "."] }
const docs = { url: "https://example.com/mcp", exposure: "direct" }

describe("readMcpScope", () => {
  it("全局作用域列出全局条目，没有继承", async () => {
    const { agentDir } = await setup({ mcpServers: { fs, docs } })
    const view = readMcpScope(agentDir, "global")

    expect(view.file).toBe(join(agentDir, "mcp.json"))
    expect(view.servers.map((s) => [s.name, s.transport, s.exposure, s.enabled])).toEqual([
      ["fs", "stdio", "codemode", true],
      ["docs", "http", "direct", true],
    ])
    expect(view.inherited).toEqual([])
  })

  it("工作区同名条目替换全局，未提到的全局条目算继承", async () => {
    const { agentDir, workspace } = await setup(
      { mcpServers: { fs, docs } },
      { mcpServers: { fs: { command: "uvx", args: ["fs-mcp"] } } },
    )
    const view = readMcpScope(agentDir, workspace)

    expect(view.file).toBe(join(workspace, ".pi", "mcp.json"))
    expect(view.servers).toHaveLength(1)
    expect(view.servers[0]).toMatchObject({ name: "fs", override: false })
    expect(view.servers[0]!.config.command).toBe("uvx")
    expect(view.inherited.map((s) => s.name)).toEqual(["docs"])
  })

  it("覆盖条目只改 enabled/exposure，其余沿用全局并标为项目覆盖", async () => {
    const { agentDir, workspace } = await setup(
      { mcpServers: { docs } },
      { mcpServers: { docs: { enabled: false, exposure: "hidden" } } },
    )
    const view = readMcpScope(agentDir, workspace)

    expect(view.servers[0]).toMatchObject({
      name: "docs",
      override: true,
      enabled: false,
      exposure: "hidden",
      transport: "http",
    })
    expect(view.servers[0]!.config.url).toBe(docs.url)
    expect(view.inherited).toEqual([])
  })

  it("无效条目不进列表，带名称与原因进 invalid", async () => {
    const { agentDir, workspace } = await setup(
      { mcpServers: { fs } },
      {
        mcpServers: {
          "legacy-sse": { type: "sse", url: "https://example.com/sse" },
          ghost: { enabled: false },
        },
      },
    )
    const view = readMcpScope(agentDir, workspace)

    expect(view.servers).toEqual([])
    expect(view.invalid.map((entry) => entry.name)).toEqual(["legacy-sse", "ghost"])
    expect(view.invalid.every((entry) => entry.message.length > 0)).toBe(true)
  })

  it("项目文件不能用 auth.provider", async () => {
    const { agentDir, workspace } = await setup(
      { mcpServers: {} },
      {
        mcpServers: { radius: { url: "https://r.example.com/mcp", auth: { provider: "radius" } } },
      },
    )

    expect(readMcpScope(agentDir, workspace).invalid.map((entry) => entry.name)).toEqual(["radius"])
  })

  it("文件缺失时为空，带 BOM 的文件照常解析", async () => {
    const { agentDir, workspace } = await setup({ mcpServers: { fs } })
    const raw = await readFile(join(agentDir, "mcp.json"), "utf8")

    await writeFile(join(agentDir, "mcp.json"), `${String.fromCharCode(0xfeff)}${raw}`)

    expect(readMcpScope(agentDir, workspace).servers).toEqual([])
    expect(readMcpScope(agentDir, workspace).inherited.map((s) => s.name)).toEqual(["fs"])
  })
})
