/** 供应商列表的纯展示数据：分组、搜索、来源文案与状态徽标。 */
import type {
  CustomModelInput,
  CustomProviderInput,
  ModelParamsFormState,
  ModelParamsPatch,
  ProviderBadge,
  ProviderGroup,
  ProviderModelView,
  ProviderView,
  ProviderSourceText,
} from "@/types/provider-type.js"

const GROUP_ORDER = ["connected", "builtin", "custom"] as const

/** 已连接优先，其余按内置/自定义拆分；空组不返回。 */
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

/** 连接来源文案：应用内 / 环境变量 / models.json / 未连接。 */
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

/** 详情徽标：等待授权优先，其次已连接/未连接。 */
export function providerStatusBadge(provider: ProviderView, authorizing: boolean): ProviderBadge {
  if (authorizing) return "authorizing"
  return provider.status.configured ? "connected" : "disconnected"
}

/** 模型行副标题：上下文规模 + 推理标记。 */
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
  /** 表单不编辑，保存时原样带回。 */
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

/** 表单草稿 → 接口载荷：必填校验、空 Key 不发、模型去重。 */
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

/** samplingParams 的值按 JSON 标量解析；对象与数组视为无效。 */
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

/** 参数表单 → 接口 patch：空值显式给 null，非法数字整单拒绝。 */
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

/** 空串表示删除（null），非法值返回 undefined。 */
function limitValue(value: string, min: number, max: number): number | null | undefined {
  if (!value.trim()) return null

  const parsed = Number(value.trim())
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined
}
