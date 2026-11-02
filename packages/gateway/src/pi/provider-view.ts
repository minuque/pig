import type { ModelRuntime } from "@earendil-works/pi-coding-agent"

export type ModelRuntimeLike = Awaited<ReturnType<typeof ModelRuntime.create>>

export type RuntimeProvider = ReturnType<ModelRuntimeLike["getProviders"]>[number]

export type RuntimeModel = ReturnType<ModelRuntimeLike["getModels"]>[number]

export type ProviderAuthStatus = ReturnType<ModelRuntimeLike["getProviderAuthStatus"]>

export type ProviderSource = NonNullable<ProviderAuthStatus["source"]>

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

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

/** runtime 的供应商是唯一真源；这里只做可序列化投影，不读凭据。 */
export function projectProvider(
  provider: RuntimeProvider,
  status: ProviderAuthStatus,
  models: readonly RuntimeModel[],
  thinkingLevels: Readonly<Record<string, string>>,
  kind: ProviderView["kind"],
): ProviderView {
  const apiKey = Boolean(provider.auth.apiKey?.login)
  const oauth = Boolean(provider.auth.oauth)
  return {
    id: provider.id,
    name: provider.name,
    ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
    kind,
    capabilities: {
      apiKey,
      oauth,
      ambient: Boolean(provider.auth.apiKey && !apiKey && !oauth),
    },
    status: { configured: status.configured, source: status.source ?? null },
    models: models.map((model) => {
      const level = thinkingLevels[`${provider.id}/${model.id}`]
      return {
        id: model.id,
        name: model.name,
        reasoning: Boolean(model.reasoning),
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
        ...(model.samplingParams ? { samplingParams: { ...model.samplingParams } } : {}),
        ...(isThinkingLevel(level) ? { thinkingLevel: level } : {}),
      }
    }),
  }
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value)
}
