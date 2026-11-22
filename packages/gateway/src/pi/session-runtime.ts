import type { AgentSession, AgentSessionEvent, EventBus } from "@earendil-works/pi-coding-agent"
import type {
  ContextPreviewKey,
  ExtensionUiResponse,
  ModelRef,
  SessionActivity,
  SessionPhase,
  SessionSnapshot,
  Task,
  TaskChannels,
  TaskStopEvent,
  TasksEvent,
  SystemEvent,
  SystemTranscriptItem,
  ThinkingLevel,
  TranscriptProgress,
} from "@pig/protocol"
import { GatewayError, SessionBusyError } from "./runtime-types.js"
import type {
  SessionRuntime,
  SessionRuntimeEvent,
  PromptInput,
  SteerInput,
} from "./runtime-types.js"
import { sessionBinding, sessionWorkspace, uploadAttachments } from "./remote-session.js"
import { ExtensionUiBridge } from "./extension-ui.js"
import { ExternalAppendCheck } from "./external-append.js"
import { composePrompt, type AttachmentSink } from "./attachments.js"
import { estimateContextUsage } from "./context-usage.js"
import { firstUserMessageText, sessionListName } from "./session-label.js"
import { TranscriptProjection } from "./transcript.js"
import { readTurnTimings } from "./turn-timing.js"

const SNAPSHOT_SKIP_EVENTS = new Set([
  "message_start",
  "message_update",
  "tool_execution_start",
  "tool_execution_end",
  "tool_execution_update",
  "bash_execution_update",
])
const TASKS_CHANNEL = "pig:tasks" satisfies keyof TaskChannels
const TASK_STOP_CHANNEL = "pig:tasks:stop" satisfies keyof TaskChannels
const PROGRESS_COALESCE_MS = 16

type StreamingProgress = Extract<TranscriptProgress, { type: "item_updated" | "assistant_delta" }>

function sameStream(a: StreamingProgress, b: StreamingProgress): boolean {
  if (a.type === "assistant_delta" && b.type === "assistant_delta")
    return a.messageId === b.messageId && a.contentIndex === b.contentIndex && a.kind === b.kind
  return a.type === "item_updated" && b.type === "item_updated" && a.item.id === b.item.id
}

function changedElsewhere(sessionId: string): GatewayError {
  return new GatewayError(
    "session_changed_elsewhere",
    `Session ${sessionId} was appended elsewhere; reload history and send again`,
  )
}

export class PiHostSession implements SessionRuntime {
  private readonly projection = new TranscriptProjection()
  private readonly listeners = new Set<(event: SessionRuntimeEvent) => void>()
  private readonly unsubscribeSession: () => void
  private revision = 0
  private busy: Promise<void> | undefined
  private disposed = false
  private readonly ui = new ExtensionUiBridge((request) => {
    if (request.method === "notify" && request.notifyType && request.notifyType !== "info") {
      this.addNotice({
        kind: "extension_notice",
        level: request.notifyType,
        message: request.message,
      })
      return
    }

    this.emit({ type: "extension_ui", request })
  })
  private activity: SessionActivity | undefined
  private readonly notices: SystemTranscriptItem[] = []
  private pendingProgress: StreamingProgress[] = []
  private pendingUpdateTimer: ReturnType<typeof setTimeout> | undefined
  private tasks: Task[] = []
  private readonly unsubscribeTasks: (() => void) | undefined
  private readonly appendCheck: ExternalAppendCheck

  constructor(
    private readonly session: AgentSession,
    private readonly onDispose?: () => void,
    private readonly attachments?: AttachmentSink,
    private readonly events?: EventBus,
  ) {
    this.appendCheck = new ExternalAppendCheck(session.sessionManager)
    this.unsubscribeSession = session.subscribe((event) => this.handleEvent(event))
    this.unsubscribeTasks = events?.on(TASKS_CHANNEL, (data) => {
      const event = data as TasksEvent

      if (event.sessionId !== session.sessionId || this.disposed) return
      this.tasks = event.tasks
      this.emit({ type: "snapshot" })
    })
  }

  stopTask(taskId: string): void {
    const event: TaskStopEvent = { sessionId: this.session.sessionId, taskId }
    this.events?.emit(TASK_STOP_CHANNEL, event)
  }

  hasRunningTasks(): boolean {
    return this.tasks.some((task) => task.status === "running" || task.status === "queued")
  }

  contextUsage(previewKey?: ContextPreviewKey) {
    return estimateContextUsage(this.session, previewKey)
  }

  get cwd(): string {
    return sessionWorkspace(this.session.sessionManager)
  }

  get loader() {
    return this.session.resourceLoader
  }

  historyTranscript() {
    const entries = this.session.sessionManager.getBranch()
    return { items: this.projection.transcript(entries), timings: readTurnTimings(entries) }
  }

  snapshot(): SessionSnapshot {
    const { session } = this
    const model = session.model

    if (!model) throw new Error("Session has no active model")

    const manager = session.sessionManager
    this.emitPendingUpdate()
    const inFlight = this.projection.inFlight(session.state.streamingMessage)
    const entries = manager.getBranch()
    const createdAt = this.sessionCreatedAt()
    const steering = session.getSteeringMessages()
    const listName = sessionListName({
      name: session.sessionName,
      firstMessage: firstUserMessageText(entries),
    })
    return {
      id: session.sessionId,
      ...(listName === undefined ? {} : { name: listName }),
      cwd: sessionWorkspace(manager),
      createdAt,
      updatedAt: this.sessionUpdatedAt(entries, createdAt),
      phase: this.getPhase(),
      ...(this.activity ? { activity: this.activity } : {}),
      model: { provider: model.provider, id: model.id },
      thinkingLevel: session.thinkingLevel,
      attached: false,
      locked: false,
      revision: this.revision,
      transcript: inFlight ? [inFlight] : [],
      queuedSteer: steering.map((text, index) => ({
        id: `steer-${index}`,
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      })),
      queuedSteerCount: steering.length,
      tasks: this.tasks,
      notices: [...this.notices],
    }
  }

  getPhase(): SessionPhase {
    const { session } = this

    // 外部：Pi 未暴露区分 branch_summary 与 compaction 的 API，两者共享 isCompacting
    if (session.isCompacting) return "compaction"

    if (session.retryAttempt > 0) return "retry"

    if (session.isStreaming) return "turn"
    return "idle"
  }

  async prompt(input: PromptInput): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("A prompt is already running")
      await this.rejectIfAppended()
      const batch = input.attachmentBatch
      const staged = (batch ? this.attachments?.take(batch) : []) ?? []

      if (batch && !staged.length)
        throw new GatewayError(
          "invalid_request",
          `Attachment batch ${batch} is not staged or has expired`,
        )

      try {
        const binding = sessionBinding(this.session.sessionManager.getEntries())
        const composed = composePrompt(
          input.text,
          binding ? await uploadAttachments(binding, this.session.sessionId, staged) : staged,
        )

        await this.session.prompt(
          composed.text,
          composed.images.length ? { images: composed.images } : undefined,
        )

        await this.session.waitForIdle()
      } catch (error) {
        if (batch) this.attachments?.restore(batch, staged)
        throw error
      } finally {
        this.broadcastSnapshot()
      }
    })
  }

  async steer(input: SteerInput): Promise<void> {
    // 外部：steer 是 turn 阶段的合法操作，不与 prompt 互斥；AgentSession.steer 仅入队，并发安全
    if (this.session.isIdle) throw new SessionBusyError("There is no active prompt to steer")
    await this.rejectIfAppended()
    await this.session.steer(input.text)
  }

  async abort(): Promise<void> {
    // 外部：AgentSession.abort 在 idle 时安全返回，无需 busy 检查
    await this.session.abort()
  }

  async compact(instructions?: string): Promise<void> {
    await this.whenIdle(async () => {
      // 外部：pi 的 compact 失败或被中止都会先发 compaction_end，失败已记进 notices
      await this.session.compact(instructions).catch(() => undefined)
    })
  }

  async reload(): Promise<void> {
    await this.whenIdle(() => this.session.reload())
    this.broadcastSnapshot()
  }

  private async whenIdle(operation: () => Promise<unknown>): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("Session is busy")
      await operation()
    })
  }

  async setModel(model: ModelRef): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("Session is busy")
      const resolved = this.session.modelRuntime.getModel(model.provider, model.id)

      if (!resolved) {
        throw new GatewayError(
          "invalid_request",
          `Model ${model.provider}/${model.id} is unavailable`,
        )
      }

      await this.session.setModel(resolved)
    })
  }

  async setThinking(thinkingLevel: ThinkingLevel): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("Session is busy")
      this.session.setThinkingLevel(thinkingLevel)
    })
  }

  setSessionName(name: string): void {
    this.session.setSessionName(name)
  }

  subscribe(listener: (event: SessionRuntimeEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async bindExtensions(): Promise<void> {
    await this.session.bindExtensions({
      uiContext: this.ui.context,
      mode: "rpc",
      onError: (error) => console.error("extension error:", error),
    })
  }

  respondExtensionUi(response: ExtensionUiResponse): void {
    this.ui.respond(response)
  }

  extensionDialogs() {
    return this.ui.dialogs()
  }

  async releaseIfAppended(): Promise<boolean> {
    if (this.disposed || !this.appendCheck.appended()) return false
    this.emit({ type: "error", error: changedElsewhere(this.session.sessionId) })
    await this.dispose()
    return true
  }

  private async rejectIfAppended(): Promise<void> {
    if (await this.releaseIfAppended()) throw changedElsewhere(this.session.sessionId)
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.ui.cancelAll()
    // 外部：照 pi 自己的收尾，先让扩展收到 session_shutdown 释放监听与子进程，再 dispose
    const runner = this.session.extensionRunner

    if (runner.hasHandlers("session_shutdown"))
      await runner
        .emit({ type: "session_shutdown", reason: "quit" })
        .catch((error: unknown) => console.error("session_shutdown failed:", error))
    this.unsubscribeSession()
    this.unsubscribeTasks?.()
    this.clearPendingUpdate()
    this.session.dispose()
    this.listeners.clear()
    this.onDispose?.()
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new SessionBusyError("Session is busy")

    const run = operation()
    this.busy = run.then(
      () => undefined,
      () => undefined,
    )

    try {
      return await run
    } finally {
      this.busy = undefined
    }
  }

  private addNotice(event: SystemEvent): void {
    this.notices.push({
      id: `notice-${this.notices.length + 1}`,
      role: "system",
      event,
      timestamp: Date.now(),
    })
    this.broadcastSnapshot()
  }

  private trackActivity(event: AgentSessionEvent): void {
    switch (event.type) {
      case "auto_retry_start":
        this.activity = {
          kind: "retry",
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          retryAt: Date.now() + event.delayMs,
          errorMessage: event.errorMessage,
        }
        return
      case "compaction_start":
        this.activity = { kind: "compaction", reason: event.reason }
        return
      case "compaction_end":
        this.activity = undefined

        if (event.errorMessage && !event.aborted)
          this.addNotice({ kind: "compaction_failed", errorMessage: event.errorMessage })
        return
      case "auto_retry_end":
        this.activity = undefined
        return
      default:
    }
  }

  private handleEvent(event: AgentSessionEvent): void {
    this.trackActivity(event)
    const progress = this.projection.progress(event)

    if (progress) this.forwardProgress(progress)

    if (event.type === "message_end") {
      queueMicrotask(() => this.broadcastSnapshot())
      return
    }

    if (!SNAPSHOT_SKIP_EVENTS.has(event.type)) this.broadcastSnapshot()
  }

  private forwardProgress(progress: TranscriptProgress): void {
    if (progress.type === "item_updated" || progress.type === "assistant_delta") {
      const last = this.pendingProgress.at(-1)

      if (last && sameStream(last, progress)) {
        this.pendingProgress[this.pendingProgress.length - 1] =
          last.type === "assistant_delta" && progress.type === "assistant_delta"
            ? { ...last, delta: last.delta + progress.delta }
            : progress
      } else this.pendingProgress.push(progress)

      this.pendingUpdateTimer ??= setTimeout(() => {
        this.pendingUpdateTimer = undefined
        this.emitPendingUpdate()
      }, PROGRESS_COALESCE_MS)
      return
    }

    this.emitPendingUpdate()
    this.revision += 1
    this.emit({ type: "progress", progress })
  }

  private emitPendingUpdate(): void {
    if (this.pendingUpdateTimer) {
      clearTimeout(this.pendingUpdateTimer)
      this.pendingUpdateTimer = undefined
    }

    const pending = this.pendingProgress
    this.pendingProgress = []

    for (const progress of pending) {
      this.revision += 1
      this.emit({ type: "progress", progress })
    }
  }

  private clearPendingUpdate(): void {
    if (this.pendingUpdateTimer) clearTimeout(this.pendingUpdateTimer)
    this.pendingUpdateTimer = undefined
    this.pendingProgress = []
  }

  private broadcastSnapshot(): void {
    this.revision += 1
    this.emit({ type: "snapshot" })
  }

  private emit(event: SessionRuntimeEvent): void {
    for (const listener of this.listeners) listener(event)
  }

  private sessionCreatedAt(): number {
    const header = this.session.sessionManager.getHeader()
    const timestamp = header?.timestamp

    if (timestamp === undefined) return Date.now()
    const parsed = Date.parse(timestamp)
    return Number.isFinite(parsed) ? parsed : Date.now()
  }

  private sessionUpdatedAt(entries: readonly { timestamp: string }[], createdAt: number): number {
    const last = entries[entries.length - 1]

    if (!last) return createdAt
    const parsed = Date.parse(last.timestamp)
    return Number.isFinite(parsed) ? parsed : createdAt
  }
}
