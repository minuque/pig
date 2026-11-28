import type {
  AskAnswer,
  ModelRef,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
  TranscriptItem,
} from "@pig/protocol"
import type { GatewayClient, Unsubscribe } from "@client/gateway-client.js"
import {
  applyTranscriptProgress,
  applyTranscriptSnapshot,
  createTranscriptState,
  selectTranscript,
  type TranscriptState,
} from "@client/transcript-state.js"

export type SessionOperation =
  | "open"
  | "create"
  | "submit"
  | "steer"
  | "abort"
  | "setModel"
  | "setThinking"
  | "compact"
  | "reload"
  | "reconnect"

export type SessionLifecycle =
  | { readonly status: "unbound" }
  | { readonly status: "ready" }
  | { readonly status: "busy"; readonly operation: SessionOperation }
  | { readonly status: "disposed" }

export interface SessionState {
  readonly lifecycle: SessionLifecycle
  readonly snapshot?: SessionSnapshot
  readonly transcript: readonly TranscriptItem[]
  readonly replacedIds?: ReadonlyMap<string, string>
}

export interface CreateSessionOptions {
  cwd: string
  model?: ModelRef
  thinkingLevel?: ThinkingLevel
}

export class GatewaySession {
  #lifecycle: SessionLifecycle = { status: "unbound" }
  #id: string | undefined
  #transcript: TranscriptState | undefined
  #unsubscribe: Unsubscribe[] = []
  readonly #active = new Set<Extract<SessionLifecycle, { status: "busy" }>>()
  readonly #listeners = new Set<(state: SessionState) => void>()

  private constructor(private readonly client: GatewayClient) {}

  static async open(client: GatewayClient, sessionId: string, options?: { takeover?: boolean }) {
    const session = new GatewaySession(client)
    await session.#bindWith("open", () =>
      client.requestSession({
        command: "attach_session",
        sessionId,
        ...(options?.takeover ? { takeover: true } : {}),
      }),
    )
    return session
  }

  static async create(client: GatewayClient, options: CreateSessionOptions) {
    const session = new GatewaySession(client)
    await session.#bindWith("create", () =>
      client.requestSession({ command: "create_session", ...options }),
    )
    return session
  }

  get id() {
    return this.#id
  }

  get snapshot() {
    return this.#transcript?.snapshot
  }

  get phase(): SessionPhase | undefined {
    return this.snapshot?.phase
  }

  get disposed() {
    return this.#lifecycle.status === "disposed"
  }

  get state(): SessionState {
    return {
      lifecycle: this.#lifecycle,
      ...(this.#transcript ? { snapshot: this.#transcript.snapshot } : {}),
      ...(this.#transcript?.replacedIds.size ? { replacedIds: this.#transcript.replacedIds } : {}),
      transcript: this.#transcript ? selectTranscript(this.#transcript) : [],
    }
  }

  subscribe(listener: (state: SessionState) => void): Unsubscribe {
    this.#assertNotDisposed()
    this.#listeners.add(listener)
    listener(this.state)
    return () => this.#listeners.delete(listener)
  }

  async submit(text: string, options?: { attachmentBatch?: string }) {
    const message = text.trim()
    const batch = options?.attachmentBatch

    if (!message && !batch) return
    const sessionId = this.#require()

    if (this.phase !== "idle" && this.phase !== "turn")
      throw new Error(`Session cannot accept input during ${this.phase ?? "unknown"} phase`)
    const idle = this.phase === "idle"

    if (!idle && batch) throw new Error("Attachments can only ride an idle prompt")
    await this.#run("submit", () =>
      this.client.requestSession(
        idle
          ? { command: "prompt", sessionId, message, ...(batch ? { attachmentBatch: batch } : {}) }
          : { command: "steer", sessionId, message },
      ),
    )
  }

  async steer(text: string) {
    const message = text.trim()

    if (!message) return
    const sessionId = this.#require()
    const preempt = this.#lifecycle.status === "busy" && this.#lifecycle.operation === "submit"

    if (this.phase === "idle") throw new Error("There is no active turn to steer")
    await this.#run(
      "steer",
      () => this.client.requestSession({ command: "steer", sessionId, message }),
      preempt,
    )
  }

  async abort() {
    const sessionId = this.#require()
    const preempt =
      this.#lifecycle.status === "busy" &&
      (this.#lifecycle.operation === "submit" || this.#lifecycle.operation === "steer")

    if (this.phase === "idle" && !preempt) return
    await this.#run(
      "abort",
      () => this.client.requestSession({ command: "abort", sessionId }),
      preempt,
    )
  }

  async stopTask(taskId: string) {
    await this.client.requestSession({ command: "stop_task", sessionId: this.#require(), taskId })
  }

  async recordAskAnswers(toolCallId: string, answers: AskAnswer[]) {
    await this.client.requestSession({
      command: "record_ask_answers",
      sessionId: this.#require(),
      toolCallId,
      answers,
    })
  }

  async setModel(model: ModelRef) {
    const sessionId = this.#requireIdle("change model")
    await this.#run("setModel", () =>
      this.client.requestSession({ command: "set_model", sessionId, model }),
    )
  }

  async setThinking(level: ThinkingLevel) {
    const sessionId = this.#requireIdle("change thinking level")
    await this.#run("setThinking", () =>
      this.client.requestSession({ command: "set_thinking_level", sessionId, level }),
    )
  }

  async compact(instructions?: string) {
    const sessionId = this.#requireIdle("compact")
    await this.#run("compact", () =>
      this.client.requestSession({
        command: "compact",
        sessionId,
        ...(instructions ? { instructions } : {}),
      }),
    )
  }

  async reload() {
    const sessionId = this.#requireIdle("reload")
    await this.#run("reload", () => this.client.requestSession({ command: "reload", sessionId }))
  }

  async reattach() {
    const sessionId = this.#require()
    await this.#bindWith("reconnect", () =>
      this.client.requestSession({ command: "attach_session", sessionId }),
    )
  }

  async dispose() {
    if (this.disposed) return
    const sessionId = this.#id
    this.#lifecycle = { status: "disposed" }
    this.#active.clear()
    this.#clear()
    this.#notify()
    this.#listeners.clear()

    if (sessionId && this.client.connectionState === "connected")
      await this.client.request({ command: "detach_session", sessionId }).catch(() => undefined)
  }

  async #bindWith(operation: SessionOperation, load: () => Promise<SessionSnapshot>) {
    const snapshot = await this.#run(operation, load)

    if (this.disposed) return
    this.#clear()
    this.#id = snapshot.id
    this.#transcript = createTranscriptState(snapshot)
    this.#unsubscribe.push(
      this.client.onSessionEvent(snapshot.id, (event) => {
        if (!this.#transcript) return
        this.#transcript =
          event.type === "session_snapshot"
            ? applyTranscriptSnapshot(this.#transcript, event.snapshot)
            : applyTranscriptProgress(this.#transcript, event.progress)
        this.#notify()
      }),
    )
    this.#notify()
  }

  async #run<T>(operation: SessionOperation, run: () => Promise<T>, preempt = false): Promise<T> {
    this.#assertNotDisposed()

    if (!preempt && this.#lifecycle.status === "busy")
      throw new Error(`Session is busy with ${this.#lifecycle.operation}`)
    const busy: Extract<SessionLifecycle, { status: "busy" }> = { status: "busy", operation }
    this.#active.add(busy)
    this.#lifecycle = busy
    this.#notify()

    try {
      return await run()
    } finally {
      this.#active.delete(busy)

      if (!this.disposed && this.#lifecycle === busy) {
        this.#lifecycle =
          [...this.#active].at(-1) ?? (this.#id ? { status: "ready" } : { status: "unbound" })
        this.#notify()
      }
    }
  }

  #require(): string {
    this.#assertNotDisposed()

    if (!this.#id) throw new Error("No session is attached")
    return this.#id
  }

  #requireIdle(description: string): string {
    const sessionId = this.#require()

    if (this.#lifecycle.status === "busy")
      throw new Error(`Session is busy with ${this.#lifecycle.operation}`)

    if (this.phase !== "idle")
      throw new Error(`Cannot ${description} while session is ${this.phase ?? "unavailable"}`)
    return sessionId
  }

  #assertNotDisposed() {
    if (this.disposed) throw new Error("Session is disposed")
  }

  #clear() {
    for (const stop of this.#unsubscribe) stop()
    this.#unsubscribe = []
  }

  #notify() {
    const state = this.state

    for (const listener of [...this.#listeners]) listener(state)
  }
}
