import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import Gateway from "../src/index.js"

let gateway: Gateway | undefined
let temp: string
let agentDir: string
let workspace: string
let base: string
const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "pig-agent-config-"))
  agentDir = join(temp, "home", ".pi", "agent")
  workspace = join(temp, "ws")
  process.env.HOME = join(temp, "home")
  process.env.USERPROFILE = join(temp, "home")
  await mkdir(agentDir, { recursive: true })
  await mkdir(join(workspace, ".git"), { recursive: true })
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
    sessionDir: join(temp, "sessions"),
    agentDir,
  })
  base = `http://127.0.0.1:${await gateway.start()}`
  await call("POST", "/api/v1/platform/select-directory")
})

afterEach(async () => {
  await gateway?.stop()
  gateway = undefined
  process.env.HOME = saved.HOME
  process.env.USERPROFILE = saved.USERPROFILE
  await rm(temp, { recursive: true, force: true, maxRetries: 5 })
})

function call(method: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: gateway?.authorizationHeader() ?? "",
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const scoped = (path: string, scope: string, extra: Record<string, string> = {}) =>
  `${path}?${new URLSearchParams({ scope, ...extra }).toString()}`

describe("MCP 路由", () => {
  it("未知工作区一律 403", async () => {
    const other = join(temp, "other")

    expect((await call("GET", scoped("/api/v1/platform/mcp", other))).status).toBe(403)
    expect(
      (
        await call("PUT", "/api/v1/platform/mcp/server", {
          scope: other,
          name: "x",
          config: { command: "npx" },
        })
      ).status,
    ).toBe(403)
  })

  it("工作区新增 server 后列表能读到，写进工作区 mcp.json", async () => {
    const put = await call("PUT", "/api/v1/platform/mcp/server", {
      scope: workspace,
      name: "fs",
      config: { command: "npx", args: ["fs"] },
    })

    expect(await put.json()).toEqual({ ok: true })
    const view = await (await call("GET", scoped("/api/v1/platform/mcp", workspace))).json()

    expect(view.servers.map((s: { name: string }) => s.name)).toEqual(["fs"])
    expect(JSON.parse(await readFile(join(workspace, ".pi", "mcp.json"), "utf8"))).toEqual({
      mcpServers: { fs: { command: "npx", args: ["fs"] } },
    })
  })

  it("无效配置不写入并返回原因", async () => {
    const put = await call("PUT", "/api/v1/platform/mcp/server", {
      scope: "global",
      name: "bad",
      config: { type: "sse", url: "https://x" },
    })
    const body = await put.json()

    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/SSE/i)
    expect(
      (await (await call("GET", scoped("/api/v1/platform/mcp", "global"))).json()).servers,
    ).toEqual([])
  })

  it("同名条目不覆盖，除非明确要求", async () => {
    const put = (body: Record<string, unknown>) =>
      call("PUT", "/api/v1/platform/mcp/server", { scope: "global", ...body }).then((r) => r.json())

    await put({ name: "gh", config: { command: "a" } })
    await put({ name: "github", config: { command: "b" } })

    expect((await put({ name: "github", config: { command: "c" } })).ok).toBe(false)
    expect((await put({ name: "github", previousName: "gh", config: { command: "c" } })).ok).toBe(
      false,
    )
    expect(
      (await put({ name: "github", previousName: "github", config: { command: "d" } })).ok,
    ).toBe(true)
    expect((await put({ name: "github", config: { command: "e" }, overwrite: true })).ok).toBe(true)

    const servers = JSON.parse(await readFile(join(agentDir, "mcp.json"), "utf8")).mcpServers

    expect(servers).toEqual({ gh: { command: "a" }, github: { command: "e" } })
  })

  it("工作区作用域不能改继承来的全局条目", async () => {
    await writeFile(
      join(agentDir, "mcp.json"),
      JSON.stringify({ mcpServers: { g: { command: "npx" } } }),
    )

    const patch = await call("PATCH", "/api/v1/platform/mcp/server", {
      scope: workspace,
      name: "g",
      enabled: false,
    })

    expect(patch.status).toBe(404)
  })
})

describe("Skills 路由", () => {
  async function skill(name: string) {
    const file = join(agentDir, "skills", name, "SKILL.md")

    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, `---\nname: ${name}\ndescription: about ${name}\n---\n\nbody\n`)
    return file
  }

  it("读取已知 Skill，未知路径 403", async () => {
    const file = await skill("alpha")
    const ok = await call(
      "GET",
      scoped("/api/v1/platform/skill-settings/file", "global", { path: file }),
    )
    const bad = await call(
      "GET",
      scoped("/api/v1/platform/skill-settings/file", "global", {
        path: join(agentDir, "auth.json"),
      }),
    )

    expect((await ok.json()).raw).toContain("name: alpha")
    expect(bad.status).toBe(403)
  })

  it("frontmatter 的 YAML 解析失败时不写入，带回 Pi 的报错", async () => {
    const file = await skill("alpha")
    const res = await call("PUT", "/api/v1/platform/skill-settings/file", {
      scope: "global",
      path: file,
      raw: "---\ndescription: a: b\n---\n",
    })
    const body = await res.json()

    expect(body.ok).toBe(false)
    expect(body.error).toContain("line 1")
    expect(await readFile(file, "utf8")).toContain("name: alpha")
  })

  it("新建后出现在列表里，停用后仍在且 enabled 为 false", async () => {
    const created = await call("POST", "/api/v1/platform/skill-settings", {
      scope: "global",
      name: "fresh",
      description: "新建",
    })
    const { filePath } = await created.json()

    await call("PATCH", "/api/v1/platform/skill-settings/enabled", {
      scope: "global",
      filePath,
      enabled: false,
    })

    const view = await (
      await call("GET", scoped("/api/v1/platform/skill-settings", "global"))
    ).json()

    expect(view.skills).toEqual([expect.objectContaining({ name: "fresh", enabled: false })])
  })
})
