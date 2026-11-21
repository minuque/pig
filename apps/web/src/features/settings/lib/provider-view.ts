import type {
  CustomModelInput,
  CustomProviderInput,
  ModelParamsPatch,
  ProviderModelView,
  ProviderView,
} from "@/types/common-type.js"
import type {
  ModelParamsFormState,
  ProviderBadge,
  ProviderGroup,
  ProviderSourceText,
} from "@/types/provider-type.js"

const GROUP_ORDER = ["connected", "builtin", "custom"] as const

export function groupProviders(providers: ProviderView[], query: string): ProviderGroup[] {
  const q = query.trim().toLowerCase()
  const matched = q
    ? providers.filter(
        (provider) =>
          provider.name.toLowerCase().includes(q) || provider.id.toLowerCase().includes(q),
      )
    : providers
  const buckets: Record<(typeof GROUP_ORDER)[number], ProviderView[]> = {
    connected: [],
    builtin: [],
    custom: [],
  }

  for (const provider of matched) {
    if (provider.status.configured) buckets.connected.push(provider)
    else if (provider.kind === "custom") buckets.custom.push(provider)
    else buckets.builtin.push(provider)
  }

  return GROUP_ORDER.filter((id) => buckets[id].length > 0).map((id) => ({
    id,
    providers: buckets[id],
  }))
}

export function providerSourceText(
  status: Pick<ProviderView["status"], "configured" | "source">,
): ProviderSourceText {
  switch (status.source) {
    case "stored":
    case "runtime":
      return "app"
    case "environment":
      return "environment"
    case "models_json_key":
    case "models_json_command":
      return "modelsJson"
    default:
      return "none"
  }
}

export function providerStatusBadge(provider: ProviderView, authorizing: boolean): ProviderBadge {
  if (authorizing) return "authorizing"
  return provider.status.configured ? "connected" : "disconnected"
}

export function modelMeta(model: ProviderModelView): string {
  const context =
    model.contextWindow >= 10_000
      ? `${Math.round(model.contextWindow / 1000)}K`
      : String(model.contextWindow)
  return model.reasoning ? `${context} · reasoning` : context
}

export interface CustomModelDraft {
  id: string
  name: string
  contextWindow: string
  maxTokens: string
  reasoning: boolean
  image: boolean
  samplingParams?: Record<string, unknown>
}

export interface CustomProviderDraft {
  id: string
  name: string
  baseUrl: string
  api: string
  apiKey: string
  models: CustomModelDraft[]
}

export type CustomProviderPayload =
  { ok: true; payload: CustomProviderInput } | { ok: false; field: "id" | "baseUrl" }

export function customProviderPayload(draft: CustomProviderDraft): CustomProviderPayload {
  const id = draft.id.trim()
  const baseUrl = draft.baseUrl.trim()

  if (!id) return { ok: false, field: "id" }

  if (!baseUrl) return { ok: false, field: "baseUrl" }

  const apiKey = draft.apiKey.trim()
  const seen = new Set<string>()
  const models: CustomModelInput[] = []

  for (const model of draft.models) {
    const modelId = model.id.trim()

    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)

    const contextWindow = positiveInteger(model.contextWindow)
    const maxTokens = positiveInteger(model.maxTokens)
    models.push({
      id: modelId,
      ...(model.name.trim() ? { name: model.name.trim() } : {}),
      input: model.image ? ["text", "image"] : ["text"],
      ...(model.reasoning ? { reasoning: true } : {}),
      ...(model.samplingParams ? { samplingParams: model.samplingParams } : {}),
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxTokens ? { maxTokens } : {}),
    })
  }

  return {
    ok: true,
    payload: {
      id,
      name: draft.name.trim() || id,
      baseUrl,
      api: draft.api,
      ...(apiKey ? { apiKey } : {}),
      models,
    },
  }
}

function positiveInteger(value: string): number | undefined {
  const parsed = Number(value.trim())
  return value.trim() && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function parseSamplingParam(value: string): unknown {
  const text = value.trim()

  if (!text) return undefined

  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === "object" ? undefined : parsed
  } catch {
    return value
  }
}

export type ParamsPatchResult =
  | { ok: true; patch: ModelParamsPatch }
  | { ok: false; fields: Array<"maxTokens" | "contextWindow"> }

export function paramsPatchFrom(form: ModelParamsFormState): ParamsPatchResult {
  const fields: Array<"maxTokens" | "contextWindow"> = []
  const maxTokens = limitValue(form.maxTokens, 1, 1_000_000)
  const contextWindow = limitValue(form.contextWindow, 1_000, 10_000_000)
  const samplingParams: Record<string, unknown> = {}

  if (maxTokens === undefined) fields.push("maxTokens")

  if (contextWindow === undefined) fields.push("contextWindow")

  for (const row of form.samplingParams) {
    const key = row.key.trim()

    if (!key) continue

    const value = parseSamplingParam(row.value)

    if (value === undefined) continue
    samplingParams[key] = value
  }

  if (fields.length) return { ok: false, fields }
  return {
    ok: true,
    patch: {
      thinkingLevel: form.thinkingLevel,
      maxTokens: maxTokens ?? null,
      contextWindow: contextWindow ?? null,
      samplingParams: Object.keys(samplingParams).length ? samplingParams : null,
    },
  }
}

function limitValue(value: string, min: number, max: number): number | null | undefined {
  if (!value.trim()) return null

  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}
