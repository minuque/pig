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

export interface SkillView {
  name: string
  description: string
  filePath: string
  enabled: boolean
  disableModelInvocation: boolean
}

export interface SkillDiagnosticView {
  kind: "broken" | "collision"
  path: string
  message: string
  name?: string
}

export interface SkillScopeView {
  roots: string[]
  skills: SkillView[]
  inherited: SkillView[]
  diagnostics: SkillDiagnosticView[]
}

export interface SkillFileView {
  raw: string
  files: string[]
}

export interface McpProbe {
  status: "connected" | "needs-auth" | "failed" | "disabled"
  tools: string[]
  error?: string
}

export interface McpProbeReport {
  probes: Record<string, McpProbe>
  note?: string
}
