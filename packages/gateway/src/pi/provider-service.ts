import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent"
import type {
  CustomProviderInput,
  DefaultModelView,
  ModelMetadata,
  ModelParamsPatch,
  ProviderTestResult,
  ProviderView,
} from "@pig/protocol"

import { toModelMetadata } from "./model-metadata.js"
import { ModelsConfigError, ProviderConfigStore } from "./models-config.js"
import {
  applyToCustomModel,
  applyToOverrides,
  errorText,
  hasModelFields,
  isCustomConfig,
  keyHint,
  objectOf,
  validatePatch,
  type StoredCredential,
} from "./provider-config.js"
import { ProviderServiceError } from "./provider-error.js"
import { LoginSessions, type LoginEventView } from "./provider-login.js"
import {
  isModelEnabled,
  projectProvider,
  toggleEnabledModel,
  type ModelRuntimeLike,
} from "./provider-view.js"

export { ProviderServiceError } from "./provider-error.js"

export type { LoginEvent, LoginEventView } from "./provider-login.js"

type AuthType = Parameters<ModelRuntimeLike["login"]>[1]

export interface ProviderServiceOptions {
  runtime: () => Promise<ModelRuntimeLike>
  /** 凭据与配置目录；缺省 ~/.pi/agent。 */
  agentDir?: string
  /** models.json 路径；缺省 agentDir/models.json。 */
  modelsPath?: string
  /** 测试注入；缺省读 agentDir 的 settings.json。 */
  settings?: SettingsManager
}

/** 供应商列表、登录事件流、模型目录与配置写入共用的 runtime 门面。 */
export class ProviderService {
  readonly agentDir: string
  readonly modelsPath: string
  private readonly customStore: ProviderConfigStore
  private settingsPromise?: Promise<SettingsManager>
  private readonly logins = new LoginSessions()

  constructor(private readonly options: ProviderServiceOptions) {
    this.agentDir = options.agentDir ?? getAgentDir()
    this.modelsPath = options.modelsPath ?? join(this.agentDir, "models.json")
    this.customStore = new ProviderConfigStore(this.modelsPath)
  }

  async listProviders(): Promise<{
    providers: ProviderView[]
    defaultModel: DefaultModelView | null
  }> {
    const runtime = await this.runtime()
    const settings = await this.settings()
    const thinkingLevels = settings.getAllModelThinkingLevels()
    const enabledModels = settings.getEnabledModels()
    const customIds = await this.customProviderIds()
    const credentials = await this.credentials()
    const providers = runtime
      .getProviders()
      .map((provider) =>
        projectProvider(
          provider,
          runtime.getProviderAuthStatus(provider.id),
          provider.getModels(),
          thinkingLevels,
          customIds.has(provider.id) ? "custom" : "builtin",
          keyHint(credentials[provider.id]),
          enabledModels,
        ),
      )
    const provider = settings.getDefaultProvider()
    const id = settings.getDefaultModel()
    return { providers, defaultModel: provider && id ? { provider, id } : null }
  }

  /** 全量刷新 runtime，再返回刷新后的供应商目录。 */
  async refreshAll(): Promise<{
    providers: ProviderView[]
    defaultModel: DefaultModelView | null
  }> {
    const runtime = await this.runtime()

    await runtime.refresh({ allowNetwork: true })
    return this.listProviders()
  }

  async listModels(): Promise<{ models: ModelMetadata[] }> {
    const runtime = await this.runtime()
    const settings = await this.settings()
    const enabledModels = settings.getEnabledModels()
    const models = await runtime.getAvailable()
    return {
      models: models
        .filter((model) => isModelEnabled(enabledModels, model.provider, model.id))
        .map((model) => toModelMetadata(model, runtime.hasConfiguredAuth(model.provider))),
    }
  }

  /** 开始一次供应商登录；事件由 loginEvents 消费。 */
  async login(providerId: string, type: AuthType): Promise<{ loginId: string }> {
    const runtime = await this.runtime()
    const provider = runtime.getProvider(providerId)

    if (!provider) throw new ProviderServiceError(404, "NOT_FOUND")

    const supported =
      type === "api_key" ? Boolean(provider.auth.apiKey?.login) : Boolean(provider.auth.oauth)

    if (!supported) throw new ProviderServiceError(400, "INVALID_REQUEST")

    if (this.logins.isActive(providerId)) throw new ProviderServiceError(409, "LOGIN_IN_PROGRESS")
    return {
      loginId: this.logins.start(providerId, type, runtime, () => this.refreshProvider(providerId)),
    }
  }

  /** 最小请求验证凭据；失败不写配置。 */
  async testConnection(providerId: string, modelId?: string): Promise<ProviderTestResult> {
    const runtime = await this.runtime()

    if (!runtime.getProvider(providerId)) throw new ProviderServiceError(404, "NOT_FOUND")

    if (!runtime.getProviderAuthStatus(providerId).configured) {
      throw new ProviderServiceError(409, "NOT_CONFIGURED")
    }

    const models = runtime.getModels(providerId)
    const model = modelId ? models.find((item) => item.id === modelId) : models[0]

    if (!model) throw new ProviderServiceError(409, "NO_MODELS")

    const started = Date.now()

    try {
      const message = await runtime.completeSimple(
        model,
        { messages: [{ role: "user", content: "ping", timestamp: started }] },
        { maxTokens: 1 },
      )

      if (message.stopReason === "error" || message.stopReason === "aborted") {
        return {
          ok: false,
          message: errorText(message.errorMessage ?? message.stopReason),
        }
      }

      return { ok: true, latencyMs: Date.now() - started }
    } catch (error) {
      return { ok: false, message: errorText(error) }
    }
  }

  /** 写模型参数：thinking 进 settings，其余进 models.json，成功后刷新。 */
  async updateModelParams(
    providerId: string,
    modelId: string,
    patch: ModelParamsPatch,
  ): Promise<void> {
    const runtime = await this.runtime()

    if (!runtime.getProvider(providerId)) throw new ProviderServiceError(404, "NOT_FOUND")
    validatePatch(patch)

    if (patch.thinkingLevel !== undefined) {
      const settings = await this.settings()

      if (patch.thinkingLevel === null) settings.removeModelThinkingLevel(providerId, modelId)
      else settings.setModelThinkingLevel(providerId, modelId, patch.thinkingLevel)
      await settings.flush()
    }

    if (hasModelFields(patch)) {
      const custom = await this.isCustomProvider(providerId)

      await this.mutateCustom((config) => {
        const providers = objectOf(config.providers)
        const provider = objectOf(providers[providerId])

        if (custom) applyToCustomModel(provider, modelId, patch)
        else applyToOverrides(provider, modelId, patch)
        providers[providerId] = provider
        config.providers = providers
      })
    }

    await this.refreshProvider(providerId)
  }

  /** 开关模型：写入 settings.enabledModels；全部开放时清空配置。 */
  async setModelEnabled(providerId: string, modelId: string, enabled: boolean): Promise<void> {
    const runtime = await this.runtime()
    const provider = runtime.getProvider(providerId)

    if (!provider) throw new ProviderServiceError(404, "NOT_FOUND")

    const models = runtime.getModels()
    const target = models.find((model) => model.provider === providerId && model.id === modelId)

    if (!target) throw new ProviderServiceError(404, "MODEL_NOT_FOUND")

    const settings = await this.settings()
    const current = settings.getEnabledModels()
    const next = toggleEnabledModel(
      current,
      models.map((model) => ({ provider: model.provider, id: model.id })),
      providerId,
      modelId,
      enabled,
    )

    settings.setEnabledModels(next)
    await settings.flush()
  }

  /** 写入自定义供应商；apiKey 留空保留旧值，成功后刷新 runtime。 */
  async saveCustom(input: CustomProviderInput): Promise<void> {
    await this.mutateCustom((config) => {
      const providers = objectOf(config.providers)
      const existing = objectOf(providers[input.id])
      const provider: Record<string, unknown> = {
        ...existing,
        name: input.name,
        api: input.api,
      }

      if (input.baseUrl) provider.baseUrl = input.baseUrl
      else delete provider.baseUrl

      if (input.apiKey) provider.apiKey = input.apiKey

      const previous = new Map(
        (Array.isArray(existing.models) ? existing.models : []).flatMap((item) => {
          const model = objectOf(item)
          return typeof model.id === "string" ? [[model.id, model] as const] : []
        }),
      )

      provider.models = input.models.map((model) => ({ ...previous.get(model.id), ...model }))
      providers[input.id] = provider
      config.providers = providers
    })
    await this.refreshProvider(input.id)
  }

  async deleteCustom(providerId: string): Promise<void> {
    await this.mutateCustom((config) => {
      const providers = objectOf(config.providers)

      if (!(providerId in providers)) throw new ProviderServiceError(404, "NOT_FOUND")
      delete providers[providerId]
      config.providers = providers
    })
    await this.refreshProvider(providerId)
  }

  /** 复制操作：唯一一次携带明文，仅供前端直接写剪贴板。 */
  async copyKey(providerId: string): Promise<{ key: string }> {
    const credential = (await this.credentials())[providerId]
    const key = credential?.type === "api_key" ? credential.key : undefined

    if (!key) throw new ProviderServiceError(404, "NOT_FOUND")
    return { key }
  }

  hasLogin(loginId: string): boolean {
    return this.logins.has(loginId)
  }

  /** 回放 after 之后的事件，再等新事件；会话结束即返回。 */
  async *loginEvents(
    loginId: string,
    after = 0,
    signal?: AbortSignal,
  ): AsyncGenerator<LoginEventView> {
    yield* this.logins.stream(loginId, after, signal)
  }

  respond(loginId: string, value: string): void {
    this.logins.respond(loginId, value)
  }

  cancelLogin(loginId: string): void {
    this.logins.cancel(loginId)
  }

  async logout(providerId: string): Promise<void> {
    const runtime = await this.runtime()

    if (!runtime.getProvider(providerId)) throw new ProviderServiceError(404, "NOT_FOUND")
    await runtime.logout(providerId, {})
    await runtime.refresh({ providers: [providerId] })
  }

  /** 停服：中止全部登录并清掉过期定时器。 */
  dispose(): void {
    this.logins.dispose()
  }

  protected runtime(): Promise<ModelRuntimeLike> {
    return this.options.runtime()
  }

  private settings(): Promise<SettingsManager> {
    return (this.settingsPromise ??= Promise.resolve(
      this.options.settings ?? SettingsManager.create(this.agentDir, this.agentDir),
    ))
  }

  private async customProviderIds(): Promise<Set<string>> {
    try {
      const config = await this.customStore.read()
      const providers = objectOf(config.providers)
      return new Set(Object.keys(providers).filter((id) => isCustomConfig(objectOf(providers[id]))))
    } catch {
      return new Set()
    }
  }

  /** 只带 modelOverrides 的条目是内置供应商的覆盖，不是自定义供应商。 */
  private async isCustomProvider(providerId: string): Promise<boolean> {
    try {
      const config = await this.customStore.read()
      return isCustomConfig(objectOf(objectOf(config.providers)[providerId]))
    } catch {
      return false
    }
  }

  private async mutateCustom<T>(
    change: (config: Record<string, unknown>) => T | Promise<T>,
  ): Promise<T> {
    try {
      return await this.customStore.mutate(change)
    } catch (error) {
      if (error instanceof ModelsConfigError) {
        throw new ProviderServiceError(409, "INVALID_MODELS_JSON")
      }

      throw error
    }
  }

  private async refreshProvider(providerId: string): Promise<void> {
    const runtime = await this.runtime()

    await runtime.refresh({ providers: [providerId], allowNetwork: true })
  }

  private async credentials(): Promise<Record<string, StoredCredential>> {
    try {
      const parsed: unknown = JSON.parse(await readFile(join(this.agentDir, "auth.json"), "utf-8"))
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, StoredCredential>)
        : {}
    } catch {
      return {}
    }
  }
}
