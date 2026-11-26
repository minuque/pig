import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent"
import { LATEST_PROTOCOL_VERSION } from "@earendil-works/pi-mcp"
import { McpOAuthAuthorizationRequiredError } from "@earendil-works/pi-mcp/oauth"
import { createInMemoryTransportPair } from "@earendil-works/pi-mcp/testing"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { killTree, McpCli, type PiRunner } from "../src/pi/mcp-cli.js"
import { probeMcpScope, type McpTransportFactory } from "../src/pi/mcp-probe.js"

let temp: string

beforeEach(async () => {
  temp = await mkdtemp(join(tmpdir(), "pig-mcp-cli-"))
})

afterEach(async () => {
  await rm(temp, { recursive: true, force: true, maxRetries: 5 })
})

function serveMemoryTools(
  tools: Array<Record<string, unknown>>,
): ReturnType<typeof createInMemoryTransportPair>["client"] {
  const { client, server } = createInMemoryTransportPair()

  void server.start()
  server.onMessage((message) => {
    if (!("id" in message) || !("method" in message)) return

    if (message.method === "initialize") {
      void server.send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "mem-mcp", version: "1.0.0" },
        },
      })
      return
    }

    if (message.method === "tools/list") {
      void server.send({
        jsonrpc: "2.0",
        id: message.id,
        result: { tools },
      })
    }
  })
  return client
}

describe("probeMcpScope", () => {
  it("提取工具完整元数据并区分 disabled / needs-auth / failed", async () => {
    const agentDir = join(temp, "agent")

    await mkdir(agentDir, { recursive: true })
    await writeFile(
      join(agentDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          fs: { command: "npx", args: ["fs"] },
          sentry: { url: "https://mcp.sentry.dev/mcp" },
          bogus: { command: "nope" },
          off: { command: "npx", enabled: false },
        },
      }),
    )

    const createTransport: McpTransportFactory = (server) => {
      if (server.name === "fs") {
        return serveMemoryTools([
          {
            name: "read_file",
            title: "Read File",
            description: "Read contents from disk",
            inputSchema: {
              type: "object",
              required: ["path"],
              properties: { path: { type: "string", description: "Target file path" } },
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
          },
          {
            name: "ping",
            inputSchema: {},
          },
        ])
      }

      if (server.name === "sentry") {
        return {
          start: async () => {
            throw new McpOAuthAuthorizationRequiredError()
          },
          send: async () => undefined,
          close: async () => undefined,
          onMessage: () => () => undefined,
          onError: () => () => undefined,
          onClose: () => () => undefined,
        }
      }

      return {
        start: async () => {
          throw new Error("Connection closed\nboom")
        },
        send: async () => undefined,
        close: async () => undefined,
        onMessage: () => () => undefined,
        onError: () => () => undefined,
        onClose: () => () => undefined,
      }
    }
    const report = await probeMcpScope("global", { agentDir, createTransport })

    expect(report.probes.fs).toEqual({
      status: "connected",
      tools: [
        {
          name: "read_file",
          title: "Read File",
          description: "Read contents from disk",
          inputSchema: {
            type: "object",
            required: ["path"],
            properties: { path: { type: "string", description: "Target file path" } },
          },
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        {
          name: "ping",
          inputSchema: { type: "object", properties: {} },
        },
      ],
    })
    expect(report.probes.sentry).toEqual({ status: "needs-auth", tools: [] })
    expect(report.probes.bogus).toEqual({
      status: "failed",
      tools: [],
      error: "Connection closed\nboom",
    })
    expect(report.probes.off).toEqual({ status: "disabled", tools: [] })
  })

  it("未决定工作区自动记为信任，明确拒绝的工作区跳过项目配置并带回说明", async () => {
    const agentDir = join(temp, "agent")
    const workspace = join(temp, "ws")

    await mkdir(agentDir, { recursive: true })
    await mkdir(join(workspace, ".pi"), { recursive: true })
    await writeFile(
      join(agentDir, "mcp.json"),
      JSON.stringify({ mcpServers: { globalSrv: { command: "npx", enabled: false } } }),
    )
    await writeFile(
      join(workspace, ".pi", "mcp.json"),
      JSON.stringify({ mcpServers: { localSrv: { command: "npx", enabled: false } } }),
    )

    const trusted = await probeMcpScope(workspace, { agentDir })

    expect(new ProjectTrustStore(agentDir).get(workspace)).toBe(true)
    expect(Object.keys(trusted.probes).sort()).toEqual(["globalSrv", "localSrv"])
    expect(trusted.note).toBeUndefined()

    new ProjectTrustStore(agentDir).set(workspace, false)
    const before = await readFile(join(agentDir, "trust.json"), "utf8")
    const untrusted = await probeMcpScope(workspace, { agentDir })

    expect(await readFile(join(agentDir, "trust.json"), "utf8")).toBe(before)
    expect(Object.keys(untrusted.probes)).toEqual(["globalSrv"])
    expect(untrusted.note).toContain("is not trusted")
  })
})

describe("真实 stdio 探活", () => {
  it("真实 stdio MCP server 返回工具描述、Schema 和 annotations", async () => {
    const agentDir = join(temp, "agent")
    const serverScript = join(temp, "echo-mcp.mjs")

    await mkdir(agentDir, { recursive: true })
    await writeFile(
      serverScript,
      [
        'let buf = ""',
        'process.stdin.setEncoding("utf8")',
        'process.stdin.on("data", (chunk) => {',
        "  buf += chunk",
        "  for (;;) {",
        '    const nl = buf.indexOf("\\n")',
        "    if (nl < 0) break",
        "    const line = buf.slice(0, nl).trim()",
        "    buf = buf.slice(nl + 1)",
        "    if (!line) continue",
        "    const msg = JSON.parse(line)",
        '    if (msg.method === "initialize") {',
        '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion ?? "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "echo", version: "1.0.0" } } }) + "\\n")',
        '    } else if (msg.method === "tools/list") {',
        '      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "sum", description: "Add two numbers", inputSchema: { type: "object", required: ["a", "b"], properties: { a: { type: "number" }, b: { type: "number" } } }, annotations: { readOnlyHint: true } }] } }) + "\\n")',
        "    }",
        "  }",
        "})",
      ].join("\n"),
    )
    await writeFile(
      join(agentDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          echo: { command: process.execPath, args: [serverScript] },
          off: { command: "npx", enabled: false },
        },
      }),
    )

    const report = await new McpCli({ agentDir }).probe("global")

    expect(report.probes.off).toEqual({ status: "disabled", tools: [] })
    expect(report.probes.echo).toEqual({
      status: "connected",
      tools: [
        {
          name: "sum",
          description: "Add two numbers",
          inputSchema: {
            type: "object",
            required: ["a", "b"],
            properties: { a: { type: "number" }, b: { type: "number" } },
          },
          annotations: { readOnlyHint: true },
        },
      ],
    })
  }, 20_000)
})

describe("McpCli 缓存与清理", () => {
  it("killTree 连同子进程派生的进程一起结束", async () => {
    const script =
      "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});" +
      "console.log(c.pid);setInterval(()=>{},1000)"
    const parent = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "ignore"] })
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

  it("probe 按作用域缓存，dispose 结束进行中的探活与登录", async () => {
    const signals: AbortSignal[] = []
    const run: PiRunner = (_args, options) =>
      new Promise((resolve) => {
        if (options.signal) signals.push(options.signal)
        options.signal?.addEventListener("abort", () => resolve({ code: 1, stdout: "{}" }))
      })
    const cli = new McpCli({
      agentDir: join(temp, "agent"),
      run,
      probe: (scope, signal) => {
        signals.push(signal)

        if (scope === "global")
          return Promise.resolve({ probes: { fs: { status: "connected", tools: [] } } })
        return new Promise((resolve) => {
          signal.addEventListener("abort", () => resolve({ probes: {} }))
        })
      },
    })

    await mkdir(join(temp, "agent"), { recursive: true })
    const cached = await cli.probe("global")

    expect(cli.cached("global")).toEqual(cached)
    expect(cli.cached(join(temp, "ws"))).toEqual({ probes: {} })

    const pending = cli.probe(join(temp, "ws"))

    cli.login("global", "x", false)
    cli.dispose()
    await pending

    expect(signals.slice(1).every((signal) => signal.aborted)).toBe(true)
    expect(signals).toHaveLength(3)
  })
})
