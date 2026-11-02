/** e2e 用的 ModelRuntime 替身：只需要配置页用到的投影与登录方法。 */

export interface FakeModelSpec {
  id: string
  name: string
  reasoning?: boolean
  contextWindow?: number
  maxTokens?: number
}

export interface FakeProviderSpec {
  id: string
  name: string
  baseUrl?: string
  auth?: "api_key" | "oauth" | "both" | "ambient"
  configured?: boolean
  source?: "stored" | "runtime" | "environment" | "models_json_key"
  models?: FakeModelSpec[]
}

interface FakeProviderState extends FakeProviderSpec {
  configured: boolean
}

const model = (providerId: string, spec: FakeModelSpec) => ({
  provider: providerId,
  id: spec.id,
  name: spec.name,
  api: "anthropic-messages",
  reasoning: spec.reasoning ?? false,
  input: ["text"],
  contextWindow: spec.contextWindow ?? 200_000,
  maxTokens: spec.maxTokens ?? 32_000,
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

export function createFakeRuntime(specs: FakeProviderSpec[]) {
  const state: FakeProviderState[] = specs.map((spec) => ({
    ...spec,
    configured: spec.configured ?? false,
  }))
  const providers = () =>
    state.map((spec) => ({
      id: spec.id,
      name: spec.name,
      ...(spec.baseUrl ? { baseUrl: spec.baseUrl } : {}),
      auth: authOf(spec.auth),
      getModels: () => (spec.models ?? []).map((item) => model(spec.id, item)),
    }))
  const modelsOf = (id?: string) =>
    state
      .filter((spec) => !id || spec.id === id)
      .flatMap((spec) => (spec.models ?? []).map((item) => model(spec.id, item)))
  return {
    state,
    getProviders: providers,
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
  }
}
