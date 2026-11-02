import { randomUUID } from "node:crypto"

import { ProviderServiceError } from "./provider-error.js"
import { errorText } from "./provider-config.js"
import type { ModelRuntimeLike } from "./provider-view.js"

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

export interface LoginSession {
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

const LOGIN_TTL_MS = 10 * 60 * 1000

/** 一次供应商登录的事件缓冲：prompt 问答、取消与事件回放。 */
export class LoginSessions {
  private readonly sessions = new Map<string, LoginSession>()

  start(
    providerId: string,
    type: AuthType,
    runtime: ModelRuntimeLike,
    refresh: () => Promise<void>,
  ): string {
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
      timer: setTimeout(() => this.close(session.id), LOGIN_TTL_MS),
    }

    session.timer.unref()
    this.sessions.set(session.id, session)
    void this.run(session, runtime, refresh)
    return session.id
  }

  has(loginId: string): boolean {
    return this.sessions.has(loginId)
  }

  isActive(providerId: string): boolean {
    return [...this.sessions.values()].some(
      (session) => session.providerId === providerId && !session.finished && !session.closed,
    )
  }

  respond(loginId: string, value: string): void {
    const session = this.sessions.get(loginId)
    const pending = session?.pending

    if (!session || session.closed) throw new ProviderServiceError(404, "NOT_FOUND")

    if (!pending) throw new ProviderServiceError(409, "NO_PENDING_PROMPT")

    session.pending = undefined
    pending.resolve(value)
  }

  cancel(loginId: string): void {
    if (!this.sessions.has(loginId)) throw new ProviderServiceError(404, "NOT_FOUND")
    this.close(loginId)
  }

  /** 回放 after 之后的事件，再等新事件；会话结束即返回。 */
  async *stream(loginId: string, after = 0, signal?: AbortSignal): AsyncGenerator<LoginEventView> {
    const session = this.sessions.get(loginId)

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

  /** 停服：中止全部登录并清掉过期定时器。 */
  dispose(): void {
    for (const id of [...this.sessions.keys()]) this.close(id)
  }

  private async run(
    session: LoginSession,
    runtime: ModelRuntimeLike,
    refresh: () => Promise<void>,
  ) {
    try {
      await runtime.login(session.providerId, session.type, {
        signal: session.controller.signal,
        prompt: (prompt) => this.requestPrompt(session, prompt),
        notify: (event) => this.push(session, event),
      })
      await refresh()
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

  private close(loginId: string) {
    const session = this.sessions.get(loginId)

    if (!session) return
    session.closed = true
    session.finished = true
    session.controller.abort()
    clearTimeout(session.timer)
    this.sessions.delete(loginId)

    if (session.pending) {
      const pending = session.pending

      session.pending = undefined
      pending.reject(new Error("login cancelled"))
    }

    this.wake(session)
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
