export type McpExposure = "codemode" | "deferred" | "direct" | "hidden"

export type AgentConfigScope = "global" | (string & {})

export interface McpServerView {
  name: string
  transport: "stdio" | "http"
  enabled: boolean
  exposure: McpExposure
  override: boolean
  config: Record<string, unknown>
}

export interface McpInvalidEntry {
  name: string
  message: string
}

export interface McpScopeView {
  file: string
  servers: McpServerView[]
  inherited: McpServerView[]
  invalid: McpInvalidEntry[]
}
