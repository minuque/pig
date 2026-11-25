import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent"
import type { AgentConfigScope, LoginEvent, McpProbe, McpProbeReport } from "@pig/protocol"

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

export function killTree(child: ChildProcess): Promise<void> {
  if (child.pid === undefined || child.exitCode !== null) return Promise.resolve()

  if (process.platform !== "win32") {
    child.kill("SIGTERM")
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    })
      .once("close", () => resolve())
      .once("error", () => resolve())
  })
}

export function piRunner(agentDir: string): PiRunner {
  return (args, { cwd, signal, onLine }) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cliPath(), ...args], {
        cwd,
        env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, ELECTRON_RUN_AS_NODE: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      })
      const stop = () => void killTree(child)

      if (signal?.aborted) stop()
      else signal?.addEventListener("abort", stop, { once: true })
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
        signal?.removeEventListener("abort", stop)

        if (pending) onLine?.(pending)
        resolve({ code: code ?? 1, stdout })
      })
    })
}

export function parseMcpList(stdout: string): McpProbeReport {
  const start = stdout.indexOf("{")
  const parsed = JSON.parse(stdout.slice(start)) as {
    servers?: Array<{ name: string; state: McpProbe["status"]; tools?: string[]; error?: string }>
    note?: string
  }
  const probes = Object.fromEntries(
    (parsed.servers ?? []).map((server) => [
      server.name,
      {
        status: server.state,
        tools: server.tools ?? [],
        ...(server.error ? { error: server.error } : {}),
      },
    ]),
  )
  return parsed.note ? { probes, note: parsed.note } : { probes }
}

export class McpCli {
  private readonly agentDir: string
  private readonly run: PiRunner
  private readonly probes = new Map<string, McpProbeReport>()
  private readonly logins = new Map<string, LoginSession>()
  private readonly running = new Set<AbortController>()

  constructor(options: { agentDir: string; run?: PiRunner }) {
    this.agentDir = options.agentDir
    this.run = options.run ?? piRunner(options.agentDir)
  }

  cached(scope: AgentConfigScope): McpProbeReport {
    return this.probes.get(scope) ?? { probes: {} }
  }

  async probe(scope: AgentConfigScope): Promise<McpProbeReport> {
    const { stdout } = await this.track(PROBE_TIMEOUT_MS, (signal) =>
      this.run(["mcp", "list", "--json"], { cwd: this.cwd(scope), signal }),
    )
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
    this.running.add(session.controller)
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
        this.running.delete(session.controller)
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

  dispose(): void {
    for (const controller of this.running) controller.abort()
    this.running.clear()
  }

  private async track<T>(timeoutMs: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()

    this.running.add(controller)

    try {
      return await task(AbortSignal.any([controller.signal, AbortSignal.timeout(timeoutMs)]))
    } finally {
      this.running.delete(controller)
    }
  }

  private cwd(scope: AgentConfigScope): string {
    if (scope === "global") return this.agentDir
    const trust = new ProjectTrustStore(this.agentDir)

    if (trust.get(scope) === null) trust.set(scope, true)
    return scope
  }
}
