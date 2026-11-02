/** e2e 用的 ModelRuntime 替身：只需要配置页用到的投影与登录方法。 */

import { readFile } from "node:fs/promises"

export interface FakeRuntimeOptions {
  /** 提供后 refresh 会把 models.json 里的自定义供应商同步进列表。 */
  modelsPath?: string
  /** 首次 refresh 时给指定供应商追加一个模型，用来验证刷新按钮。 */
  addModelOnRefresh?: { provider: string; model: FakeModelSpec } | undefined
}

export interface FakeModelSpec {
  id: string
  name: string
  reasoning?: boolean
  contextWindow?: number
  maxTokens?: number
  samplingParams?: Record<string, unknown>
}

export interface FakeProviderSpec {
  id: string
  name: string
  baseUrl?: string
  /** 供应商的 API 协议，透传到模型上。 */
  api?: string
  auth?: "api_key" | "oauth" | "both" | "ambient"
  configured?: boolean
  source?: "stored" | "runtime" | "environment" | "models_json_key"
  models?: FakeModelSpec[]
  /** 测试连接时模拟上游拒绝。 */
  failTest?: boolean
}

interface FakeProviderState extends FakeProviderSpec {
  configured: boolean
}

const model = (providerId: string, spec: FakeModelSpec, api = "anthropic-messages") => ({
  provider: providerId,
  id: spec.id,
  name: spec.name,
  api,
  reasoning: spec.reasoning ?? false,
  input: ["text"],
  contextWindow: spec.contextWindow ?? 200_000,
  maxTokens: spec.maxTokens ?? 32_000,
  ...(spec.samplingParams ? { samplingParams: spec.samplingParams } : {}),
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
})

function authOf(kind: FakeProviderSpec["auth"]) {
  const apiKey = { name: "API key", login: async () => ({ type: "api_key" }) }
  const ambient = { name: "API key", resolve: async () => undefined }
  const oauth = {
    name: "OAuth",
    login: async () => ({ type: "oauth" }),
    refresh: async (credential: unknown) => credential,
    toAuth: async () => ({}),
  }

  switch (kind) {
    case "oauth":
      return { oauth }
    case "both":
      return { apiKey, oauth }
    case "ambient":
      return { apiKey: ambient }
    default:
      return { apiKey }
  }
}

export function createFakeRuntime(specs: FakeProviderSpec[], options: FakeRuntimeOptions = {}) {
  const state: FakeProviderState[] = specs.map((spec) => ({
    ...spec,
    configured: spec.configured ?? false,
  }))
  const fromFile = new Set<string>()
  const baseModels = new Map<string, FakeModelSpec[]>(
    specs.flatMap((spec) => (spec.models ? [[spec.id, spec.models] as const] : [])),
  )

  async function syncModelsJson() {
    if (!options.modelsPath) return

    let providers: Record<string, Record<string, unknown>>

    try {
      const parsed = JSON.parse(await readFile(options.modelsPath, "utf-8")) as {
        providers?: Record<string, Record<string, unknown>>
      }

      providers = parsed.providers ?? {}
    } catch {
      return
    }

    for (const [id, config] of Object.entries(providers)) {
      if (!config.api && !config.baseUrl && !Array.isArray(config.models)) continue

      const models = Array.isArray(config.models)
        ? (config.models as FakeModelSpec[]).map((item) => ({
            id: item.id,
            name: item.name ?? item.id,
            reasoning: item.reasoning ?? false,
            contextWindow: item.contextWindow ?? 200_000,
            maxTokens: item.maxTokens ?? 32_000,
            ...(item.samplingParams ? { samplingParams: item.samplingParams } : {}),
          }))
        : []
      const next: FakeProviderState = {
        id,
        name: typeof config.name === "string" ? config.name : id,
        ...(typeof config.baseUrl === "string" ? { baseUrl: config.baseUrl } : {}),
        ...(typeof config.api === "string" ? { api: config.api } : {}),
        configured: typeof config.apiKey === "string" && config.apiKey.length > 0,
        source: "models_json_key",
        models,
      }
      const existing = state.find((item) => item.id === id)

      if (existing) Object.assign(existing, next)
      else state.push(next)
      baseModels.set(id, models)
      fromFile.add(id)
    }

    // 内置供应商的模型覆盖只写在 modelOverrides 里，按文件重算有效值。
    for (const spec of state) {
      const base = baseModels.get(spec.id)

      if (!base) continue
      const overrides = providers[spec.id]?.modelOverrides
      const byId =
        overrides && typeof overrides === "object"
          ? (overrides as Record<string, Partial<FakeModelSpec>>)
          : {}

      spec.models = base.map((item) => ({ ...item, ...(byId[item.id] ?? {}) }))
    }

    for (const id of [...fromFile]) {
      if (id in providers) continue
      const index = state.findIndex((item) => item.id === id)

      if (index >= 0) state.splice(index, 1)
      fromFile.delete(id)
    }
  }

  function addModel(providerId: string, spec: FakeModelSpec) {
    const base = [...(baseModels.get(providerId) ?? []), spec]
    const target = state.find((item) => item.id === providerId)

    baseModels.set(providerId, base)

    if (target) target.models = base
  }

  const providers = () =>
    state.map((spec) => ({
      id: spec.id,
      name: spec.name,
      ...(spec.baseUrl ? { baseUrl: spec.baseUrl } : {}),
      auth: authOf(spec.auth),
      getModels: () => (spec.models ?? []).map((item) => model(spec.id, item, spec.api)),
    }))
  const modelsOf = (id?: string) =>
    state
      .filter((spec) => !id || spec.id === id)
      .flatMap((spec) => (spec.models ?? []).map((item) => model(spec.id, item, spec.api)))
  return {
    state,
    getProviders: providers,
    getProvider: (id: string) => providers().find((provider) => provider.id === id),
    getProviderAuthStatus: (id: string) => {
      const spec = state.find((item) => item.id === id)
      return spec?.configured
        ? { configured: true, source: spec.source ?? "stored" }
        : { configured: false }
    },
    getModels: (id?: string) => modelsOf(id),
    getAvailable: async () =>
      modelsOf().filter((item) => state.find((spec) => spec.id === item.provider)?.configured),
    hasConfiguredAuth: (id: string) => Boolean(state.find((item) => item.id === id)?.configured),
    getModel: (providerId: string, modelId: string) =>
      modelsOf(providerId).find((item) => item.id === modelId),
    login: async (
      id: string,
      type: "api_key" | "oauth",
      interaction: {
        notify(event: { type: string; message?: string; url?: string; instructions?: string }): void
        prompt(prompt: { type: string; message: string }): Promise<string>
      },
    ) => {
      const spec = state.find((item) => item.id === id)

      if (!spec) throw new Error(`unknown provider ${id}`)
      interaction.notify({ type: "progress", message: "connecting" })

      if (type === "api_key") {
        const key = await interaction.prompt({ type: "secret", message: "API Key" })

        if (!key.trim()) throw new Error("empty key")
        spec.configured = true
        spec.source = "stored"
        return { type: "api_key", key }
      }

      interaction.notify({
        type: "auth_url",
        url: "https://auth.example/authorize",
        instructions: "在浏览器完成授权",
      })
      spec.configured = true
      spec.source = "stored"
      return { type: "oauth" }
    },
    refresh: async (refreshOptions?: { providers?: string[] }) => {
      const added = refreshOptions?.providers ? undefined : options.addModelOnRefresh

      if (added) {
        options.addModelOnRefresh = undefined
        addModel(added.provider, added.model)
      }

      await syncModelsJson()
      return { aborted: false, errors: new Map() }
    },
    completeSimple: async (selected: { provider: string }) => {
      const spec = state.find((item) => item.id === selected.provider)

      if (spec?.failTest) throw new Error("upstream rejected the key")
      return { stopReason: "stop" }
    },
    logout: async (id: string) => {
      const spec = state.find((item) => item.id === id)

      if (spec) spec.configured = false
    },
  }
}
