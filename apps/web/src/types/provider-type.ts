/** 供应商配置页的数据形状；与 gateway /api/v1/platform/providers 对齐。 */

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export type ProviderSource =
  "stored" | "runtime" | "environment" | "fallback" | "models_json_key" | "models_json_command"

export interface ProviderModelView {
  id: string
  name: string
  reasoning: boolean
  contextWindow: number
  maxTokens: number
  samplingParams?: Record<string, unknown>
  thinkingLevel?: ThinkingLevel
}

export interface ProviderView {
  id: string
  name: string
  baseUrl?: string
  kind: "builtin" | "custom"
  capabilities: { apiKey: boolean; oauth: boolean; ambient: boolean }
  status: { configured: boolean; source: ProviderSource | null; hint: string | null }
  models: ProviderModelView[]
}

export interface DefaultModelView {
  provider: string
  id: string
}

export interface ProviderListResponse {
  providers: ProviderView[]
  defaultModel: DefaultModelView | null
}

export interface ProviderTestResult {
  ok: boolean
  latencyMs?: number
  message?: string
}

export type ProviderBadge = "connected" | "disconnected" | "authorizing"

export type ProviderSourceText = "app" | "environment" | "modelsJson" | "none"

export type ProviderGroupId = "connected" | "builtin" | "custom"

export interface ProviderGroup {
  id: ProviderGroupId
  providers: ProviderView[]
}

export interface LoginPrompt {
  id: string
  type: "text" | "secret" | "select" | "manual_code"
  message: string
  placeholder?: string
  options?: Array<{ id: string; label: string; description?: string }>
}

export type LoginEvent =
  | { type: "info"; message: string; seq: number }
  | { type: "auth_url"; url: string; instructions?: string; seq: number }
  | { type: "device_code"; userCode: string; verificationUri: string; seq: number }
  | { type: "progress"; message: string; seq: number }
  | { type: "prompt"; id: string; prompt: LoginPrompt; seq: number }
  | { type: "done"; seq: number }
  | { type: "error"; message: string; seq: number }
