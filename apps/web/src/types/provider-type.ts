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
  status: { configured: boolean; source: ProviderSource | null }
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

export type ProviderBadge = "connected" | "disconnected" | "authorizing"

export type ProviderSourceText = "app" | "environment" | "modelsJson" | "none"

export type ProviderGroupId = "connected" | "builtin" | "custom"

export interface ProviderGroup {
  id: ProviderGroupId
  providers: ProviderView[]
}
