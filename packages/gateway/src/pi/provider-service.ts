import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent"
import type { ModelMetadata } from "@earendil-works/pi-protocol"
import { toProtocolModelMetadata } from "@earendil-works/pi-server"

import {
  projectProvider,
  type DefaultModelView,
  type ModelRuntimeLike,
  type ProviderView,
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
}

/** 供应商列表、登录事件流、模型目录与配置写入共用的 runtime 门面。 */
export class ProviderService {
  readonly agentDir: string
  readonly modelsPath: string
  private settingsPromise?: Promise<SettingsManager>
  private readonly logins = new Map<string, LoginSession>()

  constructor(private readonly options: ProviderServiceOptions) {
    this.agentDir = options.agentDir ?? getAgentDir()
    this.modelsPath = options.modelsPath ?? join(this.agentDir, "models.json")
  }

  async listProviders(): Promise<{
    providers: ProviderView[]
    defaultModel: DefaultModelView | null
  }> {
    const runtime = await this.runtime()
    const settings = await this.settings()
    const thinkingLevels = settings.getAllModelThinkingLevels()
    const customIds = await this.customProviderIds()
    const providers = runtime
      .getProviders()
      .map((provider) =>
        projectProvider(
          provider,
          runtime.getProviderAuthStatus(provider.id),
          provider.getModels(),
          thinkingLevels,
          customIds.has(provider.id) ? "custom" : "builtin",
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
      SettingsManager.create(this.agentDir, this.agentDir),
    ))
  }

  private async customProviderIds(): Promise<Set<string>> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.modelsPath, "utf-8"))
      const providers = (parsed as { providers?: unknown })?.providers
      return new Set(providers && typeof providers === "object" ? Object.keys(providers) : [])
    } catch {
      return new Set()
    }
  }
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
