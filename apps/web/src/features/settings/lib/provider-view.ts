/** 供应商列表的纯展示数据：分组、搜索、来源文案与状态徽标。 */
import type {
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
export function providerSourceText(status: ProviderView["status"]): ProviderSourceText {
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
