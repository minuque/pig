import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { isMcpServerOverride, mcpNamespace, validateMcpServerConfig } from "@earendil-works/pi-mcp"
import type {
  AgentConfigScope,
  McpExposure,
  McpInvalidEntry,
  McpScopeView,
  McpServerView,
} from "@pig/protocol"

const EXPOSURES: readonly McpExposure[] = ["codemode", "deferred", "direct", "hidden"]
const EXPOSURE_ALIASES: Record<string, McpExposure> = { "codemode-deferred": "codemode" }
const OVERRIDE_KEYS = ["enabled", "exposure", "toolExposure"]
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

type Entry = Record<string, unknown>

type Origin = "global" | "project"

interface ParsedFile {
  servers: Array<[string, unknown]>
  invalid: McpInvalidEntry[]
}

export function mcpConfigFile(agentDir: string, scope: AgentConfigScope): string {
  return scope === "global" ? join(agentDir, "mcp.json") : join(scope, ".pi", "mcp.json")
}

function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function parseFile(path: string): ParsedFile {
  if (!existsSync(path)) return { servers: [], invalid: [] }

  let parsed: unknown

  try {
    parsed = JSON.parse(stripBom(readFileSync(path, "utf8")))
  } catch (error) {
    return { servers: [], invalid: [{ name: "mcp.json", message: String(error) }] }
  }

  if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers)))
    return {
      servers: [],
      invalid: [{ name: "mcp.json", message: 'expected an object with an "mcpServers" object' }],
    }
  return { servers: Object.entries(parsed.mcpServers ?? {}), invalid: [] }
}

function resolveAliases(raw: Entry): Entry {
  const resolved = { ...raw }
  const alias = (value: unknown) =>
    typeof value === "string" ? (EXPOSURE_ALIASES[value] ?? value) : value

  if (raw.exposure !== undefined) resolved.exposure = alias(raw.exposure)

  if (isRecord(raw.toolExposure))
    resolved.toolExposure = Object.fromEntries(
      Object.entries(raw.toolExposure).map(([tool, value]) => [tool, alias(value)]),
    )
  return resolved
}

function piFieldError(config: Entry, origin: Origin): string | undefined {
  const isExposure = (value: unknown) => EXPOSURES.includes(value as McpExposure)

  if (config.exposure !== undefined && !isExposure(config.exposure))
    return `exposure must be one of ${EXPOSURES.join(", ")}`

  if (config.toolExposure !== undefined) {
    if (!isRecord(config.toolExposure)) return "toolExposure must map tool names to exposures"
    const bad = Object.entries(config.toolExposure).find(([, value]) => !isExposure(value))

    if (bad) return `toolExposure "${bad[0]}" must be one of ${EXPOSURES.join(", ")}`
  }

  if (config.auth === undefined || typeof config.url !== "string") return undefined

  if (origin === "project") return "auth is only allowed in the global mcp.json"

  if (!isRecord(config.auth) || typeof config.auth.provider !== "string" || !config.auth.provider)
    return "auth.provider must be a provider name"
  const url = new URL(config.url)

  if (url.protocol !== "https:" && !LOOPBACK_HOSTS.includes(url.hostname))
    return "auth requires an https URL, or http on localhost, 127.0.0.1, or [::1]"
  return undefined
}

export function validateServer(
  name: string,
  raw: unknown,
  origin: Origin,
): { config: Entry; transport: "stdio" | "http" } | { error: string } {
  const result = validateMcpServerConfig(name, isRecord(raw) ? resolveAliases(raw) : raw, {
    checkMetadataDocumentCallback: (callbackUrl) => {
      if (callbackUrl === undefined) return undefined
      const url = new URL(callbackUrl)
      return url.hostname !== "[::1]" && url.pathname === "/callback"
        ? undefined
        : 'oauth.clientRegistration "cimd" requires oauth.callbackUrl on localhost or 127.0.0.1 with path /callback'
    },
  })

  if (result.kind === "invalid") return { error: result.error }
  const config = result.config as Entry
  const error = piFieldError(config, origin)
  return error ? { error } : { config, transport: result.kind }
}

function view(name: string, config: Entry, transport: "stdio" | "http", override: boolean) {
  return {
    name,
    transport,
    enabled: config.enabled !== false,
    exposure: (config.exposure as McpExposure | undefined) ?? "codemode",
    override,
    config,
  } satisfies McpServerView
}

function readGlobal(agentDir: string) {
  const { servers, invalid } = parseFile(mcpConfigFile(agentDir, "global"))
  const valid = new Map<string, McpServerView>()

  for (const [name, raw] of servers) {
    const result = validateServer(name, raw, "global")

    if ("error" in result) {
      invalid.push({ name, message: result.error })
      continue
    }

    const clash = [...valid.keys()].find((other) => mcpNamespace(other) === mcpNamespace(name))

    if (clash) invalid.push({ name, message: `conflicts with "${clash}"` })
    else valid.set(name, view(name, result.config, result.transport, false))
  }

  return { valid, invalid }
}

function readProject(cwd: string, global: Map<string, McpServerView>) {
  const { servers, invalid } = parseFile(mcpConfigFile("", cwd))
  const valid: McpServerView[] = []

  for (const [name, raw] of servers) {
    if (isRecord(raw) && isMcpServerOverride(raw)) {
      const base = global.get(name)
      const extra = Object.keys(raw).filter((key) => !OVERRIDE_KEYS.includes(key))

      if (!base) {
        invalid.push({ name, message: 'needs "command" or "url", or a global server to override' })
        continue
      }

      if (extra.length) {
        invalid.push({ name, message: `an override can only set ${OVERRIDE_KEYS.join(", ")}` })
        continue
      }

      const merged = validateServer(name, { ...base.config, ...raw }, "global")

      if ("error" in merged) invalid.push({ name, message: merged.error })
      else valid.push(view(name, merged.config, merged.transport, true))
      continue
    }

    const result = validateServer(name, raw, "project")

    if ("error" in result) invalid.push({ name, message: result.error })
    else valid.push(view(name, result.config, result.transport, false))
  }

  return { valid, invalid, names: new Set(servers.map(([name]) => name)) }
}

export function readMcpScope(agentDir: string, scope: AgentConfigScope): McpScopeView {
  const global = readGlobal(agentDir)
  const file = mcpConfigFile(agentDir, scope)

  if (scope === "global")
    return { file, servers: [...global.valid.values()], inherited: [], invalid: global.invalid }

  const project = readProject(scope, global.valid)
  return {
    file,
    servers: project.valid,
    inherited: [...global.valid.values()].filter((server) => !project.names.has(server.name)),
    invalid: project.invalid,
  }
}
