import type { McpExposure, McpProbe, McpServerView } from "@pig/protocol"

export interface KvRow {
  key: string
  value: string
}

export interface McpDraft {
  name: string
  transport: "stdio" | "http"
  command: string
  args: string
  cwd: string
  env: KvRow[]
  url: string
  headers: KvRow[]
  description: string
  timeout: string
  exposure: McpExposure
  enabled: boolean
  oauthClientId: string
  oauthClientSecret: string
  oauthScope: string
  authProvider: string
}

type Config = Record<string, unknown>

export const EXPOSURES: McpExposure[] = ["codemode", "deferred", "direct", "hidden"]
const MANAGED = [
  "type",
  "command",
  "args",
  "cwd",
  "env",
  "url",
  "headers",
  "description",
  "timeout",
  "exposure",
  "enabled",
  "auth",
]
const str = (value: unknown) => (typeof value === "string" ? value : "")

function rows(value: unknown): KvRow[] {
  if (typeof value !== "object" || value === null) return []
  return Object.entries(value as Record<string, unknown>).map(([key, raw]) => ({
    key,
    value: str(raw),
  }))
}

export function joinArgs(args: unknown): string {
  if (!Array.isArray(args)) return ""
  return args.map((arg) => (/\s|"/.test(String(arg)) ? JSON.stringify(arg) : String(arg))).join(" ")
}

export function splitArgs(text: string): string[] {
  return [...text.matchAll(/"((?:\\.|[^"\\])*)"|(\S+)/g)].map((match) =>
    match[1] === undefined ? match[2]! : (JSON.parse(`"${match[1]}"`) as string),
  )
}

export function draftFromConfig(name: string, config: Config): McpDraft {
  const oauth = (config.oauth ?? {}) as Config
  const auth = (config.auth ?? {}) as Config
  return {
    name,
    transport: typeof config.url === "string" ? "http" : "stdio",
    command: str(config.command),
    args: joinArgs(config.args),
    cwd: str(config.cwd),
    env: rows(config.env),
    url: str(config.url),
    headers: rows(config.headers),
    description: str(config.description),
    timeout: typeof config.timeout === "number" ? String(config.timeout) : "",
    exposure: (config.exposure as McpExposure | undefined) ?? "codemode",
    enabled: config.enabled !== false,
    oauthClientId: str(oauth.clientId),
    oauthClientSecret: str(oauth.clientSecret),
    oauthScope: str(oauth.scope),
    authProvider: str(auth.provider),
  }
}

function record(list: KvRow[]): Record<string, string> | undefined {
  const entries = list.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value])
  return entries.length ? Object.fromEntries(entries) : undefined
}

function oauthOf(draft: McpDraft, base: Config | undefined): Config | undefined {
  const next: Config = { ...((base?.oauth ?? {}) as Config) }
  const set = (key: string, value: string) => {
    if (value.trim()) next[key] = value.trim()
    else delete next[key]
  }

  set("clientId", draft.oauthClientId)
  set("clientSecret", draft.oauthClientSecret)
  set("scope", draft.oauthScope)
  return Object.keys(next).length ? next : undefined
}

export function configFromDraft(draft: McpDraft, base?: Config): Config {
  const kept = Object.fromEntries(
    Object.entries(base ?? {}).filter(([key]) => !MANAGED.includes(key) && key !== "oauth"),
  )
  const timeout = Number(draft.timeout)
  const transport: Config =
    draft.transport === "stdio"
      ? {
          command: draft.command.trim(),
          ...(splitArgs(draft.args).length ? { args: splitArgs(draft.args) } : {}),
          ...(draft.cwd.trim() ? { cwd: draft.cwd.trim() } : {}),
          ...(record(draft.env) ? { env: record(draft.env) } : {}),
        }
      : {
          url: draft.url.trim(),
          ...(record(draft.headers) ? { headers: record(draft.headers) } : {}),
          ...(oauthOf(draft, base) ? { oauth: oauthOf(draft, base) } : {}),
          ...(draft.authProvider.trim() ? { auth: { provider: draft.authProvider.trim() } } : {}),
        }
  return {
    ...transport,
    ...kept,
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.timeout.trim() && Number.isFinite(timeout) ? { timeout } : {}),
    ...(draft.exposure !== "codemode" ? { exposure: draft.exposure } : {}),
    ...(draft.enabled ? {} : { enabled: false }),
  }
}

export function oauthAction(
  server: Pick<McpServerView, "transport" | "config">,
  probe: McpProbe | undefined,
): "login" | "logout" | undefined {
  const headers = (server.config.headers ?? {}) as Record<string, unknown>
  const usesHeader = Object.keys(headers).some((key) => key.toLowerCase() === "authorization")

  if (server.transport !== "http" || server.config.auth || usesHeader) return undefined

  if (probe?.status === "needs-auth") return "login"
  return probe?.status === "connected" ? "logout" : undefined
}

export function searchText(config: Record<string, unknown>): string {
  const command =
    typeof config.command === "string" ? `${config.command} ${joinArgs(config.args)}` : ""
  return [config.description, command.trim(), config.url].filter(Boolean).join(" ")
}
