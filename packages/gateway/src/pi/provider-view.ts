import type { ModelRuntime } from "@earendil-works/pi-coding-agent"
import type { ProviderView, ThinkingLevel } from "@pig/protocol"

export type ModelRuntimeLike = Awaited<ReturnType<typeof ModelRuntime.create>>

export type RuntimeProvider = ReturnType<ModelRuntimeLike["getProviders"]>[number]

export type RuntimeModel = ReturnType<ModelRuntimeLike["getModels"]>[number]

export type ProviderAuthStatus = ReturnType<ModelRuntimeLike["getProviderAuthStatus"]>

export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const satisfies readonly ThinkingLevel[]

/** runtime 的供应商是唯一真源；这里只做可序列化投影，不读凭据。 */
export function projectProvider(
  provider: RuntimeProvider,
  status: ProviderAuthStatus,
  models: readonly RuntimeModel[],
  thinkingLevels: Readonly<Record<string, string>>,
  kind: ProviderView["kind"],
  hint: string | null = null,
  enabledModels?: readonly string[],
): ProviderView {
  const apiKey = Boolean(provider.auth.apiKey?.login)
  const oauth = Boolean(provider.auth.oauth)
  const api = models[0]?.api
  return {
    id: provider.id,
    name: provider.name,
    ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
    ...(api ? { api } : {}),
    kind,
    capabilities: {
      apiKey,
      oauth,
      ambient: Boolean(provider.auth.apiKey && !apiKey && !oauth),
    },
    status: {
      configured: status.configured,
      source: status.source ?? null,
      hint: status.configured ? hint : null,
    },
    models: models.map((model) => {
      const level = thinkingLevels[`${provider.id}/${model.id}`]
      return {
        id: model.id,
        name: model.name,
        ...(model.input ? { input: [...model.input] } : {}),
        reasoning: Boolean(model.reasoning),
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
        ...(model.samplingParams ? { samplingParams: { ...model.samplingParams } } : {}),
        ...(isThinkingLevel(level) ? { thinkingLevel: level } : {}),
        enabled: isModelEnabled(enabledModels, provider.id, model.id),
      }
    }),
  }
}

/** 模型引用匹配：支持 provider/model、裸 id，以及 `:thinkingLevel` 后缀。 */
function matchesModelRef(pattern: string, providerId: string, modelId: string) {
  const ref = pattern.toLowerCase()
  const colon = ref.lastIndexOf(":")
  const bareRef = colon > 0 && isThinkingLevel(ref.slice(colon + 1)) ? ref.slice(0, colon) : ref
  return bareRef === `${providerId}/${modelId}`.toLowerCase() || bareRef === modelId.toLowerCase()
}

export function isModelEnabled(
  enabledModels: readonly string[] | undefined,
  providerId: string,
  modelId: string,
): boolean {
  if (enabledModels === undefined) return true
  return enabledModels.some((pattern) => matchesModelRef(pattern, providerId, modelId))
}

/** 从开放列表移除或加入一个模型；覆盖全部模型时恢复为未配置。 */
export function toggleEnabledModel(
  enabledModels: readonly string[] | undefined,
  allModels: readonly { provider: string; id: string }[],
  providerId: string,
  modelId: string,
  enabled: boolean,
): string[] | undefined {
  const current =
    enabledModels === undefined
      ? allModels.map((model) => `${model.provider}/${model.id}`)
      : [...enabledModels]
  const next = enabled
    ? [
        ...current.filter((pattern) => !matchesModelRef(pattern, providerId, modelId)),
        `${providerId}/${modelId}`,
      ]
    : current.filter((pattern) => !matchesModelRef(pattern, providerId, modelId))
  const coversAll = allModels.every((model) =>
    next.some((pattern) => matchesModelRef(pattern, model.provider, model.id)),
  )
  return coversAll ? undefined : next
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value)
}
