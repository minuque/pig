import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { isMcpServerOverride } from "@earendil-works/pi-mcp"
import type { McpExposure } from "@pig/protocol"

type Entry = Record<string, unknown>

function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function editServers(path: string, edit: (servers: Entry) => void): void {
  const raw = existsSync(path) ? readFileSync(path, "utf8") : undefined
  const text = raw?.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const parsed: unknown = text === undefined ? {} : JSON.parse(text)

  if (!isRecord(parsed) || (parsed.mcpServers !== undefined && !isRecord(parsed.mcpServers)))
    throw new Error(`${path}: expected an object with an "mcpServers" object`)

  const servers = isRecord(parsed.mcpServers) ? parsed.mcpServers : {}

  edit(servers)
  parsed.mcpServers = servers
  const indent = (text && /^([ \t]+)\S/m.exec(text)?.[1]) || "  "

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(parsed, null, indent)}\n`)
}

export function putMcpServer(
  path: string,
  name: string,
  config: Entry,
  previousName?: string,
): void {
  editServers(path, (servers) => {
    if (previousName && previousName !== name) delete servers[previousName]
    servers[name] = config
  })
}

export function patchMcpServer(
  path: string,
  name: string,
  patch: { enabled?: boolean; exposure?: McpExposure },
): void {
  editServers(path, (servers) => {
    const server = servers[name]

    if (!isRecord(server)) throw new Error(`${path} does not define MCP server "${name}"`)
    const keepDefaults = isMcpServerOverride(server)

    if (patch.enabled !== undefined) {
      if (patch.enabled && !keepDefaults) delete server.enabled
      else server.enabled = patch.enabled
    }

    if (patch.exposure !== undefined) {
      if (patch.exposure === "codemode" && !keepDefaults) delete server.exposure
      else server.exposure = patch.exposure
    }
  })
}

export function removeMcpServer(path: string, name: string): void {
  editServers(path, (servers) => {
    delete servers[name]
  })
}
