import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent"
import type { ModelMetadata } from "@earendil-works/pi-protocol"
import { toProtocolModelMetadata } from "@earendil-works/pi-server"

import { ModelsConfigError, ProviderConfigStore } from "./models-config.js"
import {
  isThinkingLevel,
  projectProvider,
  type DefaultModelView,
  type ModelRuntimeLike,
  type ProviderView,
  type ThinkingLevel,
} from "./provider-view.js"

type AuthType = Parameters<ModelRuntimeLike["login"]>[1]

type AuthInteraction = Parameters<ModelRuntimeLike["login"]>[2]

type AuthPrompt = Parameters<AuthInteraction["prompt"]>[0]

type AuthEvent = Parameters<AuthInteraction["notify"]>[0]

export interface LoginPromptView {
  id: string
  type: AuthPrompt["type"]
  message: string
  placeholder?: string
  options?: Array<{ id: string; label: string; description?: string }>
}

export type LoginEvent =
  | AuthEvent
  | { type: "prompt"; id: string; prompt: LoginPromptView }
  | { type: "done" }
  | { type: "error"; message: string }

export type LoginEventView = LoginEvent & { seq: number }

interface PendingPrompt {
  id: string
  resolve(value: string): void
  reject(error: Error): void
}

interface LoginSession {
  id: string
  providerId: string
  type: AuthType
  events: LoginEventView[]
  waiters: Array<() => void>
  pending: PendingPrompt | undefined
  controller: AbortController
  finished: boolean
  closed: boolean
  timer: ReturnType<typeof setTimeout>
}

export interface TestConnectionResult {
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
  reasoning?: boolean
  input?: string[]
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

export class ProviderServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
  ) {
    super(message)
  }
}

const LOGIN_TTL_MS = 10 * 60 * 1000
const MAX_ERROR_LENGTH = 500

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
  private readonly logins = new Map<string, LoginSession>()

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
        ),
      )
    const provider = settings.getDefaultProvider()
    const id = settings.getDefaultModel()
    return { providers, defaultModel: provider && id ? { provider, id } : null }
  }

  async listModels(): Promise<{ models: ModelMetadata[] }> {
    const runtime = await this.runtime()
    const models = await runtime.getAvailable()
    return {
      models: models.map((model) =>
        toProtocolModelMetadata(model, runtime.hasConfiguredAuth(model.provider)),
      ),
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

    if (this.activeLogin(providerId)) throw new ProviderServiceError(409, "LOGIN_IN_PROGRESS")

    const session: LoginSession = {
      id: randomUUID(),
      providerId,
      type,
      events: [],
      waiters: [],
      pending: undefined,
      controller: new AbortController(),
      finished: false,
      closed: false,
      timer: setTimeout(() => this.closeLogin(session.id), LOGIN_TTL_MS),
    }

    session.timer.unref()
    this.logins.set(session.id, session)
    void this.runLogin(session, runtime)
    return { loginId: session.id }
  }

  /** 最小请求验证凭据；失败不写配置。 */
  async testConnection(providerId: string, modelId?: string): Promise<TestConnectionResult> {
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
      provider.models = input.models.map((model) => ({ ...model }))
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
    const session = this.logins.get(loginId)

    if (!session) throw new ProviderServiceError(404, "NOT_FOUND")

    let cursor = 0

    while (true) {
      while (cursor < session.events.length) {
        const event = session.events[cursor++]

        if (event && event.seq > after) yield event
      }

      if (session.finished || session.closed || signal?.aborted) return

      await new Promise<void>((resolve) => {
        const wake = () => {
          signal?.removeEventListener("abort", wake)
          resolve()
        }

        session.waiters.push(wake)
        signal?.addEventListener("abort", wake, { once: true })
      })
    }
  }

  respond(loginId: string, value: string): void {
    const session = this.logins.get(loginId)
    const pending = session?.pending

    if (!session || session.closed) throw new ProviderServiceError(404, "NOT_FOUND")

    if (!pending) throw new ProviderServiceError(409, "NO_PENDING_PROMPT")

    session.pending = undefined
    pending.resolve(value)
  }

  cancelLogin(loginId: string): void {
    const session = this.logins.get(loginId)

    if (!session) throw new ProviderServiceError(404, "NOT_FOUND")
    this.closeLogin(loginId)
  }

  async logout(providerId: string): Promise<void> {
    const runtime = await this.runtime()

    if (!runtime.getProvider(providerId)) throw new ProviderServiceError(404, "NOT_FOUND")
    await runtime.logout(providerId, {})
    await runtime.refresh({ providers: [providerId] })
  }

  /** 停服：中止全部登录并清掉过期定时器。 */
  dispose(): void {
    for (const id of [...this.logins.keys()]) this.closeLogin(id)
  }

  protected runtime(): Promise<ModelRuntimeLike> {
    return this.options.runtime()
  }

  private async runLogin(session: LoginSession, runtime: ModelRuntimeLike) {
    try {
      await runtime.login(session.providerId, session.type, {
        signal: session.controller.signal,
        prompt: (prompt) => this.requestPrompt(session, prompt),
        notify: (event) => this.push(session, event),
      })
      await runtime.refresh({ providers: [session.providerId] })
      this.push(session, { type: "done" })
    } catch (error) {
      if (!session.closed) {
        this.push(session, { type: "error", message: errorText(error) })
      }
    } finally {
      session.finished = true
      this.wake(session)
    }
  }

  private requestPrompt(session: LoginSession, prompt: AuthPrompt): Promise<string> {
    const id = randomUUID()

    this.push(session, { type: "prompt", id, prompt: promptView(id, prompt) })
    return new Promise<string>((resolve, reject) => {
      const pending: PendingPrompt = { id, resolve, reject }
      session.pending = pending
      prompt.signal?.addEventListener(
        "abort",
        () => {
          if (session.pending !== pending) return
          session.pending = undefined
          reject(new Error("prompt aborted"))
        },
        { once: true },
      )
    })
  }

  private push(session: LoginSession, event: LoginEvent) {
    if (session.closed) return
    session.events.push({ ...event, seq: session.events.length + 1 } as LoginEventView)
    this.wake(session)
  }

  private wake(session: LoginSession) {
    const waiters = session.waiters.splice(0)

    for (const wake of waiters) wake()
  }

  private activeLogin(providerId: string): boolean {
    return [...this.logins.values()].some(
      (session) => session.providerId === providerId && !session.finished && !session.closed,
    )
  }

  private closeLogin(loginId: string) {
    const session = this.logins.get(loginId)

    if (!session) return
    session.closed = true
    session.finished = true
    session.controller.abort()
    clearTimeout(session.timer)
    this.logins.delete(loginId)

    if (session.pending) {
      const pending = session.pending

      session.pending = undefined
      pending.reject(new Error("login cancelled"))
    }

    this.wake(session)
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

    await runtime.refresh({ providers: [providerId] })
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

interface StoredCredential {
  type?: string
  key?: string
}

function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isCustomConfig(provider: Record<string, unknown>): boolean {
  return Boolean(provider.api || provider.baseUrl || provider.models)
}

function validatePatch(patch: ModelParamsPatch): void {
  const positive = (value: number | null | undefined) =>
    value === undefined || value === null || (Number.isInteger(value) && value > 0)

  if (!positive(patch.maxTokens) || !positive(patch.contextWindow)) {
    throw new ProviderServiceError(400, "INVALID_REQUEST")
  }

  if (
    patch.thinkingLevel !== undefined &&
    patch.thinkingLevel !== null &&
    !isThinkingLevel(patch.thinkingLevel)
  ) {
    throw new ProviderServiceError(400, "INVALID_REQUEST")
  }

  if (
    patch.samplingParams !== undefined &&
    patch.samplingParams !== null &&
    (typeof patch.samplingParams !== "object" || Array.isArray(patch.samplingParams))
  ) {
    throw new ProviderServiceError(400, "INVALID_REQUEST")
  }
}

function hasModelFields(patch: ModelParamsPatch): boolean {
  return (
    patch.maxTokens !== undefined ||
    patch.contextWindow !== undefined ||
    patch.samplingParams !== undefined
  )
}

function applyToOverrides(
  provider: Record<string, unknown>,
  modelId: string,
  patch: ModelParamsPatch,
): void {
  const overrides = objectOf(provider.modelOverrides)
  const entry = objectOf(overrides[modelId])

  applyFields(entry, patch)

  if (Object.keys(entry).length) overrides[modelId] = entry
  else delete overrides[modelId]

  provider.modelOverrides = overrides
}

function applyToCustomModel(
  provider: Record<string, unknown>,
  modelId: string,
  patch: ModelParamsPatch,
): void {
  const models = Array.isArray(provider.models) ? provider.models : []
  const model = models.find((item) => objectOf(item).id === modelId)

  if (!model) throw new ProviderServiceError(404, "NOT_FOUND")
  applyFields(model as Record<string, unknown>, patch)
  provider.models = models
}

function applyFields(entry: Record<string, unknown>, patch: ModelParamsPatch): void {
  if (patch.maxTokens !== undefined) {
    if (patch.maxTokens === null) delete entry.maxTokens
    else entry.maxTokens = patch.maxTokens
  }

  if (patch.contextWindow !== undefined) {
    if (patch.contextWindow === null) delete entry.contextWindow
    else entry.contextWindow = patch.contextWindow
  }

  if (patch.samplingParams !== undefined) {
    if (patch.samplingParams === null) delete entry.samplingParams
    else entry.samplingParams = { ...patch.samplingParams }
  }
}

function keyHint(credential: StoredCredential | undefined): string | null {
  if (credential?.type !== "api_key" || typeof credential.key !== "string") return null
  return credential.key.length >= 4 ? credential.key.slice(-4) : null
}

function promptView(id: string, prompt: AuthPrompt): LoginPromptView {
  return {
    id,
    type: prompt.type,
    message: prompt.message,
    ...("placeholder" in prompt && prompt.placeholder ? { placeholder: prompt.placeholder } : {}),
    ...(prompt.type === "select"
      ? {
          options: prompt.options.map((option) => ({
            id: option.id,
            label: option.label,
            ...(option.description ? { description: option.description } : {}),
          })),
        }
      : {}),
  }
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAX_ERROR_LENGTH)
}
