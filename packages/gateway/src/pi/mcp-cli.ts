import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent"
import type { AgentConfigScope, LoginEvent, McpProbe } from "@pig/protocol"

const PROBE_TIMEOUT_MS = 60_000
const LOGIN_TIMEOUT_S = 300
const URL_LINE = /^https?:\/\/\S+$/

export interface PiRunOptions {
  cwd: string
  signal?: AbortSignal
  onLine?: (line: string) => void
}

export type PiRunner = (
  args: string[],
  options: PiRunOptions,
) => Promise<{ code: number; stdout: string }>

type Draft<E> = E extends LoginEvent ? Omit<E, "seq"> : never

interface LoginSession {
  events: LoginEvent[]
  waiters: Array<() => void>
  controller: AbortController
  finished: boolean
}

function cliPath(): string {
  const entry = fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"))
  return join(dirname(entry), "bundle", "cli.js")
}

export function piRunner(agentDir: string): PiRunner {
  return (args, { cwd, signal, onLine }) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath(), ...args], {
        cwd,
        env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        ...(signal ? { signal } : {}),
      })
      let stdout = ""
      let pending = ""
      const feed = (chunk: Buffer) => {
        const text = chunk.toString("utf8")

        stdout += text
        pending += text
        const lines = pending.split(/\r?\n/)

        pending = lines.pop() ?? ""

        for (const line of lines) onLine?.(line)
      }

      child.stdout.on("data", feed)
      child.stderr.on("data", feed)
      child.once("error", reject)
      child.once("close", (code) => {
        if (pending) onLine?.(pending)
        resolve({ code: code ?? 1, stdout })
      })
    })
}

export function parseMcpList(stdout: string): Record<string, McpProbe> {
  const start = stdout.indexOf("{")
  const parsed = JSON.parse(stdout.slice(start)) as {
    servers?: Array<{ name: string; state: McpProbe["status"]; tools?: string[]; error?: string }>
  }
  return Object.fromEntries(
    (parsed.servers ?? []).map((server) => [
      server.name,
      {
        status: server.state,
        tools: server.tools ?? [],
        ...(server.error ? { error: server.error } : {}),
      },
    ]),
  )
}

export class McpCli {
  private readonly agentDir: string
  private readonly run: PiRunner
  private readonly probes = new Map<string, Record<string, McpProbe>>()
  private readonly logins = new Map<string, LoginSession>()

  constructor(options: { agentDir: string; run?: PiRunner }) {
    this.agentDir = options.agentDir
    this.run = options.run ?? piRunner(options.agentDir)
  }

  cached(scope: AgentConfigScope): Record<string, McpProbe> {
    return this.probes.get(scope) ?? {}
  }

  async probe(scope: AgentConfigScope): Promise<Record<string, McpProbe>> {
    const { stdout } = await this.run(["mcp", "list", "--json"], {
      cwd: this.cwd(scope),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    const result = parseMcpList(stdout)

    this.probes.set(scope, result)
    return result
  }

  async logout(scope: AgentConfigScope, name: string, local: boolean): Promise<void> {
    const { code, stdout } = await this.run(
      ["mcp", "logout", name, ...(local ? ["--local"] : [])],
      {
        cwd: this.cwd(scope),
      },
    )

    if (code !== 0) throw new Error(stdout.trim() || `pi mcp logout exited with ${code}`)
  }

  login(scope: AgentConfigScope, name: string, local: boolean): string {
    const id = randomUUID()
    const session: LoginSession = {
      events: [],
      waiters: [],
      controller: new AbortController(),
      finished: false,
    }
    const push = (event: Draft<LoginEvent>) => {
      session.events.push({ ...event, seq: session.events.length + 1 } as LoginEvent)

      for (const wake of session.waiters.splice(0)) wake()
    }
    const args = ["mcp", "login", name, "--timeout", String(LOGIN_TIMEOUT_S)]

    this.logins.set(id, session)
    this.run(local ? [...args, "--local"] : args, {
      cwd: this.cwd(scope),
      signal: session.controller.signal,
      onLine: (line) => {
        const text = line.trim()

        if (URL_LINE.test(text)) push({ type: "auth_url", url: text })
        else if (text) push({ type: "progress", message: text })
      },
    })
      .then(({ code, stdout }) =>
        push(
          code === 0
            ? { type: "done" }
            : { type: "error", message: stdout.trim().split(/\r?\n/).pop() ?? "" },
        ),
      )
      .catch((error: unknown) => push({ type: "error", message: String(error) }))
      .finally(() => {
        session.finished = true

        for (const wake of session.waiters.splice(0)) wake()
      })
    return id
  }

  hasLogin(id: string): boolean {
    return this.logins.has(id)
  }

  async *loginEvents(id: string, after: number, signal: AbortSignal): AsyncGenerator<LoginEvent> {
    const session = this.logins.get(id)

    if (!session) return
    let next = after

    while (!signal.aborted) {
      while (next < session.events.length) yield session.events[next++]!

      if (session.finished) return
      await new Promise<void>((resolve) => {
        session.waiters.push(resolve)
        signal.addEventListener("abort", () => resolve(), { once: true })
      })
    }
  }

  cancelLogin(id: string): void {
    this.logins.get(id)?.controller.abort()
  }

  private cwd(scope: AgentConfigScope): string {
    if (scope === "global") return this.agentDir
    const trust = new ProjectTrustStore(this.agentDir)

    if (trust.get(scope) === null) trust.set(scope, true)
    return scope
  }
}
