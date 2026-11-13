import type { ThinkingLevel } from "./model.js"

export type ProviderSource =
  "stored" | "runtime" | "environment" | "fallback" | "models_json_key" | "models_json_command"

export interface ProviderModelView {
  id: string
  name: string
  input?: string[]
  reasoning: boolean
  contextWindow: number
  maxTokens: number
  samplingParams?: Record<string, unknown>
  thinkingLevel?: ThinkingLevel
  /** 是否在 enabledModels 开放列表内；未配置表示全部开放，空列表表示全部关闭。 */
  enabled: boolean
}

export interface ProviderView {
  id: string
  name: string
  baseUrl?: string
  api?: string
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

export interface ModelParamsPatch {
  thinkingLevel?: ThinkingLevel | null
  maxTokens?: number | null
  contextWindow?: number | null
  samplingParams?: Record<string, unknown> | null
}

export interface CustomModelInput {
  id: string
  name?: string
  input?: string[]
  reasoning?: boolean
  contextWindow?: number
  maxTokens?: number
  samplingParams?: Record<string, unknown>
}

export interface CustomProviderInput {
  id: string
  name: string
  baseUrl?: string
  api: string
  /** 空串或省略表示保留旧值。 */
  apiKey?: string
  models: CustomModelInput[]
}

export interface LoginPrompt {
  id: string
  type: "text" | "secret" | "select" | "manual_code"
  message: string
  placeholder?: string
  options?: Array<{ id: string; label: string; description?: string }>
}

/** 登录事件流（SSE）的一帧；seq 单调递增，断线后按它续传。 */
export type LoginEvent =
  | { type: "info"; message: string; seq: number }
  | { type: "auth_url"; url: string; instructions?: string; seq: number }
  | { type: "device_code"; userCode: string; verificationUri: string; seq: number }
  | { type: "progress"; message: string; seq: number }
  | { type: "prompt"; id: string; prompt: LoginPrompt; seq: number }
  | { type: "done"; seq: number }
  | { type: "error"; message: string; seq: number }
