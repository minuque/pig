import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { killTree, McpCli, parseMcpList, type PiRunner } from "../src/pi/mcp-cli.js"

const sample = JSON.stringify({
  servers: [
    {
      name: "fs",
      scope: "global",
      enabled: true,
      exposure: "codemode",
      transport: "npx fs",
      state: "connected",
      tools: ["read_file", "write_file"],
    },
    {
      name: "sentry",
      scope: "global",
      enabled: true,
      exposure: "codemode",
      transport: "https://mcp.sentry.dev/mcp",
      state: "needs-auth",
      tools: [],
      error: "authorization required",
    },
    {
      name: "bogus",
      scope: "global",
      enabled: true,
      exposure: "codemode",
      transport: "nope",
      state: "failed",
      tools: [],
      error: "MCP connection closed\nboom",
    },
    {
      name: "off",
      scope: "global",
      enabled: false,
      exposure: "codemode",
      transport: "npx",
      state: "disabled",
      tools: [],
    },
  ],
  errors: ['mcp.json: server "bad": legacy SSE transport is not supported'],
})
let temp: string

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "pig-mcp-cli-"))
})

afterEach(async () => {
  await rm(temp, { recursive: true, force: true, maxRetries: 5 })
})

describe("parseMcpList", () => {
  it("带回 CLI 关于未信任项目的说明", () => {
    const note = ".pi/mcp.json is ignored because the project is not trusted."

    expect(parseMcpList(JSON.stringify({ servers: [], errors: [], note })).note).toBe(note)
  })

  it("按名称取出状态、工具名和错误", () => {
    const { probes } = parseMcpList(`${sample}\n`)

    expect(probes.fs).toEqual({ status: "connected", tools: ["read_file", "write_file"] })
    expect(probes.sentry).toMatchObject({ status: "needs-auth", tools: [] })
    expect(probes.bogus).toEqual({
      status: "failed",
      tools: [],
      error: "MCP connection closed\nboom",
    })
    expect(probes.off).toEqual({ status: "disabled", tools: [] })
  })
})

function recorder(stdout = sample, code = 1) {
  const calls: Array<{ args: string[]; cwd: string; trusted: boolean | null }> = []
  const agentDir = join(temp, "agent")
  const run: PiRunner = async (args, options) => {
    calls.push({
      args,
      cwd: options.cwd,
      trusted: new ProjectTrustStore(agentDir).get(options.cwd),
    })
    return { code, stdout }
  }

  return { calls, agentDir, cli: new McpCli({ agentDir, run }) }
}

describe("McpCli.probe", () => {
  it("退出码为 1 也解析结果，并按作用域缓存", async () => {
    const { cli, agentDir } = recorder()

    await mkdir(agentDir, { recursive: true })
    const result = await cli.probe("global")

    expect(result.probes.fs?.status).toBe("connected")
    expect(cli.cached("global")).toEqual(result)
    expect(cli.cached(join(temp, "ws"))).toEqual({ probes: {} })
  })

  it("工作区作用域先把工作区记为信任，再在工作区里运行", async () => {
    const { cli, calls, agentDir } = recorder()
    const workspace = join(temp, "ws")

    await mkdir(workspace, { recursive: true })
    await cli.probe(workspace)

    expect(calls[0]).toEqual({ args: ["mcp", "list", "--json"], cwd: workspace, trusted: true })
    expect(new ProjectTrustStore(agentDir).get(workspace)).toBe(true)
  })

  it("用户明确不信任的工作区不改写", async () => {
    const { cli, agentDir } = recorder()
    const workspace = join(temp, "ws")

    await mkdir(workspace, { recursive: true })
    await mkdir(agentDir, { recursive: true })
    new ProjectTrustStore(agentDir).set(workspace, false)
    const before = await readFile(join(agentDir, "trust.json"), "utf8")

    await cli.probe(workspace)

    expect(await readFile(join(agentDir, "trust.json"), "utf8")).toBe(before)
  })
})

describe("真实 Pi CLI", () => {
  it("依赖自带的 CLI 能启动并返回探活结果", async () => {
    const agentDir = join(temp, "agent")

    await mkdir(agentDir, { recursive: true })
    await writeFile(
      join(agentDir, "mcp.json"),
      JSON.stringify({ mcpServers: { off: { command: "npx", enabled: false } } }),
    )

    expect((await new McpCli({ agentDir }).probe("global")).probes).toEqual({
      off: { status: "disabled", tools: [] },
    })
  }, 60_000)
})

describe("子进程清理", () => {
  it("killTree 连同子进程派生的进程一起结束", async () => {
    const script =
      "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});" +
      "console.log(c.pid);setInterval(()=>{},1000)"
    const parent = spawn(process.execPath, ["-e", script], {
      stdio: ["ignore", "pipe", "ignore"],
      detached: process.platform !== "win32",
    })
    const grandchild = await new Promise<number>((resolve) =>
      parent.stdout.once("data", (chunk: Buffer) => resolve(Number(chunk.toString().trim()))),
    )
    const alive = (pid: number) => {
      try {
        process.kill(pid, 0)
        return true
      } catch {
        return false
      }
    }

    await killTree(parent)
    await new Promise((resolve) => setTimeout(resolve, 500))

    expect(alive(grandchild)).toBe(false)
  }, 20_000)

  it("dispose 结束进行中的调用", async () => {
    const signals: AbortSignal[] = []
    const run: PiRunner = (_args, options) =>
      new Promise((resolve) => {
        if (options.signal) signals.push(options.signal)
        options.signal?.addEventListener("abort", () => resolve({ code: 1, stdout: "{}" }))
      })
    const cli = new McpCli({ agentDir: join(temp, "agent"), run })

    await mkdir(join(temp, "agent"), { recursive: true })
    const pending = cli.probe("global")

    cli.login("global", "x", false)
    cli.dispose()
    await pending

    expect(signals.every((signal) => signal.aborted)).toBe(true)
    expect(signals).toHaveLength(2)
  })
})
