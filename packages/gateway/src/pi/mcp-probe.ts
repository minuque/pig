import { execSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { basename, dirname, join, resolve } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { pathToFileURL } from "node:url"
import { getShellConfig, ProjectTrustStore, VERSION } from "@earendil-works/pi-coding-agent"
import {
  McpAuthRequiredError,
  McpClient,
  McpHttpError,
  mcpNamespace,
  normalizeMcpInputSchema,
  StdioTransport,
  StreamableHttpTransport,
  type AuthProvider,
  type McpTransport,
  type Tool,
} from "@earendil-works/pi-mcp"
import {
  createMcpAuthProvider,
  McpOAuthAuthorizationRequiredError,
  type McpAuthProvider,
  type McpOAuthServerStore,
  type McpOAuthSettings,
  type McpOAuthState,
} from "@earendil-works/pi-mcp/oauth"
import type {
  AgentConfigScope,
  McpProbe,
  McpProbeReport,
  McpServerView,
  McpToolView,
} from "@pig/protocol"

import { mcpConfigFile, readMcpScope } from "./mcp-config.js"

const DEFAULT_TIMEOUT_SECONDS = 60
const STDERR_TAIL_CHARS = 2_000
const RETRY_DELAYS_MS = [250, 1_000]
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const ENV_PREFIX = /^[A-Za-z_][A-Za-z0-9_]*/

export type McpTransportFactory = (
  server: McpServerView,
  cwd: string,
  authProvider?: AuthProvider,
) => McpTransport

export interface ProbeMcpOptions {
  agentDir: string
  providerToken?: ((provider: string) => Promise<string | undefined>) | undefined
  createTransport?: McpTransportFactory | undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function expandHome(value: string): string {
  if (value === "~") return homedir()

  if (value.startsWith("~/") || (process.platform === "win32" && value.startsWith("~\\"))) {
    return join(homedir(), value.slice(2))
  }

  return value
}

function runShell(command: string): string | undefined {
  if (process.platform === "win32") {
    try {
      const { shell, args, commandTransport } = getShellConfig()
      const stdinMode = commandTransport === "stdin"
      const result = spawnSync(shell, stdinMode ? args : [...args, command], {
        encoding: "utf-8",
        input: stdinMode ? command : undefined,
        timeout: 10_000,
        stdio: [stdinMode ? "pipe" : "ignore", "pipe", "ignore"],
        shell: false,
        windowsHide: true,
      })

      if (!result.error) return result.status === 0 ? result.stdout.trim() || undefined : undefined
    } catch {
      return undefined
    }
  }

  try {
    return (
      execSync(command, {
        encoding: "utf-8",
        timeout: 10_000,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      }).trim() || undefined
    )
  } catch {
    return undefined
  }
}

function resolveTemplate(template: string, description: string): string {
  let out = ""
  const missing: string[] = []
  let i = 0

  while (i < template.length) {
    const dollar = template.indexOf("$", i)

    if (dollar < 0) {
      out += template.slice(i)
      break
    }

    out += template.slice(i, dollar)
    const next = template[dollar + 1]

    if (next === "$" || next === "!") {
      out += next
      i = dollar + 2
      continue
    }

    if (next === "{") {
      const end = template.indexOf("}", dollar + 2)

      if (end < 0) {
        out += "$"
        i = dollar + 1
        continue
      }

      const name = template.slice(dollar + 2, end)

      if (ENV_NAME.test(name)) {
        const value = process.env[name]

        if (value === undefined || value === "") missing.push(name)
        else out += value
      } else {
        out += template.slice(dollar, end + 1)
      }

      i = end + 1
      continue
    }

    const match = ENV_PREFIX.exec(template.slice(dollar + 1))

    if (match) {
      const name = match[0]
      const value = process.env[name]

      if (value === undefined || value === "") missing.push(name)
      else out += value
      i = dollar + 1 + name.length
      continue
    }

    out += "$"
    i = dollar + 1
  }

  if (missing.length > 0) {
    throw new Error(
      `Failed to resolve ${description} from environment variable: ${missing.join(", ")}`,
    )
  }

  return out
}

function resolveConfigValue(value: string, description: string): string {
  if (value.startsWith("!")) {
    const resolved = runShell(value.slice(1))

    if (resolved !== undefined) return resolved
    throw new Error(`Failed to resolve ${description} from shell command: ${value.slice(1)}`)
  }

  return resolveTemplate(value, description)
}

function resolveRecord(input: unknown, description: string): Record<string, string> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") out[key] = resolveConfigValue(value, `${description} "${key}"`)
  }

  return Object.keys(out).length > 0 ? out : undefined
}

function readAuthStates(path: string): Record<string, McpOAuthState> {
  if (!existsSync(path)) return {}

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, McpOAuthState>)
      : {}
  } catch {
    return {}
  }
}

function createOAuthStore(
  agentDir: string,
): (name: string, serverUrl: string) => McpOAuthServerStore {
  const path = join(agentDir, "mcp-auth.json")
  const locks = new Map<string, Promise<unknown>>()
  let writeChain = Promise.resolve()
  const writeStates = (update: (states: Record<string, McpOAuthState>) => void) => {
    writeChain = writeChain.then(() => {
      const states = readAuthStates(path)

      update(states)
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
      writeFileSync(path, `${JSON.stringify(states, null, 2)}\n`, { mode: 0o600 })
    })
    return writeChain
  }

  return (name: string, serverUrl: string) => {
    const legacyKey = String(new URL(serverUrl))
    const key = `${mcpNamespace(name)}|${legacyKey}`
    return {
      load: async () => {
        await writeChain.catch(() => undefined)
        const states = readAuthStates(path)

        if (states[key] || !states[legacyKey]) return states[key]
        const migrated = states[legacyKey]

        await writeStates((next) => {
          if (!next[key] && next[legacyKey]) {
            next[key] = next[legacyKey]
            delete next[legacyKey]
          }
        }).catch(() => undefined)
        return migrated
      },
      save: async (state) => {
        await writeStates((states) => {
          states[key] = state
        })
      },
      withRefreshLock: async <T>(fn: () => Promise<T>): Promise<T> => {
        const prev = locks.get(key) ?? Promise.resolve()
        const next = prev.catch(() => undefined).then(fn)
        const settled = next.then(
          () => undefined,
          () => undefined,
        )

        locks.set(key, settled)

        try {
          return await next
        } finally {
          if (locks.get(key) === settled) locks.delete(key)
        }
      },
    }
  }
}

function listsRedirectUrl(redirectUrl: string): boolean {
  const url = new URL(redirectUrl)
  return url.hostname !== "[::1]" && url.pathname === "/callback"
}

function oauthSettingsOf(server: McpServerView): McpOAuthSettings {
  const oauth = server.config.oauth as Record<string, unknown> | undefined

  if (!oauth) return {}
  const reg = oauth.clientRegistration
  return {
    ...(typeof oauth.clientId === "string" ? { clientId: oauth.clientId } : {}),
    ...(typeof oauth.clientSecret === "string"
      ? {
          clientSecret: resolveConfigValue(
            oauth.clientSecret,
            `MCP server "${server.name}" oauth.clientSecret`,
          ),
        }
      : {}),
    ...(typeof oauth.callbackPort === "number" ? { callbackPort: oauth.callbackPort } : {}),
    ...(typeof oauth.callbackUrl === "string" ? { callbackUrl: oauth.callbackUrl } : {}),
    ...(typeof oauth.scope === "string" ? { scope: oauth.scope } : {}),
    ...(typeof oauth.clientName === "string" ? { clientName: oauth.clientName } : {}),
    ...(reg === "auto" || reg === "dcr" || reg === "cimd" ? { clientRegistration: reg } : {}),
    ...(typeof oauth.authServerMetadataUrl === "string"
      ? { authServerMetadataUrl: new URL(oauth.authServerMetadataUrl) }
      : {}),
  }
}

function authOf(
  server: McpServerView,
  storeFor: ReturnType<typeof createOAuthStore>,
  providerToken?: (provider: string) => Promise<string | undefined>,
): McpAuthProvider | undefined {
  const { config } = server

  if (server.transport !== "http" || typeof config.url !== "string") return undefined
  const auth = config.auth as { provider?: unknown } | undefined

  if (typeof auth?.provider === "string" && auth.provider) {
    const provider = auth.provider
    return {
      token: async () => providerToken?.(provider),
      settled: async () => undefined,
    }
  }

  const headers = config.headers as Record<string, unknown> | undefined
  const hasAuthHeader = Object.keys(headers ?? {}).some((k) => k.toLowerCase() === "authorization")

  if (hasAuthHeader) return undefined
  return createMcpAuthProvider({
    serverUrl: config.url,
    store: storeFor(server.name, config.url),
    settings: () => oauthSettingsOf(server),
    clientName: "pi",
    clientMetadataDocuments: { baseUrl: "https://pi.dev/oauth", listsRedirectUrl },
    onChallenge: () => undefined,
  })
}

function defaultTransport(
  server: McpServerView,
  cwd: string,
  authProvider?: AuthProvider,
): McpTransport {
  const { config, name } = server

  if (server.transport === "http" && typeof config.url === "string") {
    const headers = resolveRecord(config.headers, `MCP server "${name}" header`)
    return new StreamableHttpTransport({
      url: config.url,
      ...(headers ? { headers } : {}),
      ...(authProvider ? { authProvider } : {}),
    })
  }

  const args = Array.isArray(config.args)
    ? config.args.map((arg) => expandHome(String(arg)))
    : undefined
  const env = resolveRecord(config.env, `MCP server "${name}" env`)
  return new StdioTransport({
    command: expandHome(String(config.command)),
    ...(args && args.length > 0 ? { args } : {}),
    cwd: resolve(cwd, expandHome(typeof config.cwd === "string" ? config.cwd : ".")),
    ...(env ? { env } : {}),
    stderr: "pipe",
  })
}

function isTransientError(error: unknown): boolean {
  if (error instanceof McpHttpError) {
    return (
      error.status === 408 || error.status === 429 || (error.status >= 500 && error.status !== 501)
    )
  }

  return error instanceof TypeError
}

export function toToolView(tool: Tool): McpToolView {
  return {
    name: tool.name,
    ...(tool.title !== undefined ? { title: tool.title } : {}),
    ...(tool.description !== undefined ? { description: tool.description } : {}),
    inputSchema: normalizeMcpInputSchema(tool.inputSchema),
    ...(tool.outputSchema !== undefined ? { outputSchema: tool.outputSchema } : {}),
    ...(tool.annotations !== undefined ? { annotations: tool.annotations } : {}),
  }
}

async function probeServer(
  server: McpServerView,
  cwd: string,
  storeFor: ReturnType<typeof createOAuthStore>,
  options: ProbeMcpOptions,
  signal?: AbortSignal,
): Promise<McpProbe> {
  if (!server.enabled) return { status: "disabled", tools: [] }
  const authProvider = authOf(server, storeFor, options.providerToken)
  const timeout =
    typeof server.config.timeout === "number" ? server.config.timeout : DEFAULT_TIMEOUT_SECONDS
  const retries = server.transport === "http" ? RETRY_DELAYS_MS : []
  const transportFactory = options.createTransport ?? defaultTransport

  for (let attempt = 0; ; attempt++) {
    const client = new McpClient({
      name: "pi",
      version: VERSION,
      requestTimeoutMs: timeout * 1000,
      roots: [{ uri: pathToFileURL(cwd).href, name: basename(cwd) }],
    })
    const onAbort = () => void client.close().catch(() => undefined)
    let transport: McpTransport | undefined

    signal?.addEventListener("abort", onAbort, { once: true })

    try {
      if (signal?.aborted) throw new Error("Probe aborted")
      transport = transportFactory(server, cwd, authProvider)
      await client.connect(transport)
      const listOptions = signal ? { signal } : undefined
      const tools = client.serverCapabilities?.tools ? await client.listTools(listOptions) : []
      return { status: "connected", tools: tools.map(toToolView) }
    } catch (error) {
      if (
        error instanceof McpOAuthAuthorizationRequiredError ||
        (authProvider !== undefined && error instanceof McpAuthRequiredError)
      ) {
        return { status: "needs-auth", tools: [] }
      }

      const delay = retries[attempt]

      if (!signal?.aborted && delay !== undefined && isTransientError(error)) {
        await sleep(delay, undefined, signal ? { signal } : undefined).catch(() => undefined)
        continue
      }

      const tail =
        transport instanceof StdioTransport ? transport.stderr.trim().slice(-STDERR_TAIL_CHARS) : ""
      const detail = tail ? `${errorMessage(error)}\n${tail}` : errorMessage(error)
      return { status: "failed", tools: [], error: detail }
    } finally {
      signal?.removeEventListener("abort", onAbort)
      await client.close().catch(() => undefined)
      await authProvider?.settled().catch(() => undefined)
    }
  }
}

export async function probeMcpScope(
  scope: AgentConfigScope,
  options: ProbeMcpOptions,
  signal?: AbortSignal,
): Promise<McpProbeReport> {
  let trusted = true
  let note: string | undefined

  if (scope !== "global") {
    const trust = new ProjectTrustStore(options.agentDir)

    if (trust.get(scope) === null) trust.set(scope, true)
    trusted = trust.get(scope) === true

    if (!trusted) {
      const projectFile = mcpConfigFile(options.agentDir, scope)

      if (existsSync(projectFile)) {
        note = `${projectFile} is ignored because the project is not trusted. Start pi in the project to trust it.`
      }
    }
  }

  const cwd = scope === "global" ? options.agentDir : scope
  const view = readMcpScope(options.agentDir, trusted ? scope : "global")
  const servers = [...view.servers, ...view.inherited]
  const storeFor = createOAuthStore(options.agentDir)
  const entries = await Promise.all(
    servers.map(
      async (server) =>
        [server.name, await probeServer(server, cwd, storeFor, options, signal)] as const,
    ),
  )
  const probes = Object.fromEntries(entries)
  return note ? { probes, note } : { probes }
}
