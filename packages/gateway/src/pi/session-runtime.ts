import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import type {
  ExtensionUiResponse,
  ModelRef,
  SessionPhase,
  SessionSnapshot,
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
import { canonicalizePath } from "../directory.js"
import { sessionBinding, sessionWorkspace, uploadAttachments } from "./remote-session.js"
import { ExtensionUiBridge } from "./extension-ui.js"
import { composePrompt, type AttachmentSink } from "./attachments.js"
import { expandFileMentions } from "./file-mentions.js"
import { estimateContextUsage, type ContextPreviewKey } from "./context-usage.js"
import { firstUserMessageText, sessionListName } from "./session-label.js"
import { TranscriptProjection } from "./transcript.js"
import { readTurnTimings, TurnTimingRecorder } from "./turn-timing.js"

/**
 * 不触发全量 snapshot 广播的事件：高频增量，或产生进度时尚未持久化
 * （message_start/tool_execution_start 的条目在事件后才落盘），广播旧快照
 * 会让客户端清掉刚收到的 progress。权威 snapshot 由 message_end 延迟广播。
 */
const SNAPSHOT_SKIP_EVENTS = new Set([
  "message_start",
  "message_update",
  "tool_execution_start",
  "tool_execution_end",
  "tool_execution_update",
  "bash_execution_update",
])
/** 流式合流窗口：同块的连续增量拼成一条，同条目的连续整条更新只留最后一帧。 */
const PROGRESS_COALESCE_MS = 16

type StreamingProgress = Extract<TranscriptProgress, { type: "item_updated" | "assistant_delta" }>

/** 两帧是否落在同一个流上：同块增量，或同条目的整条更新。 */
function sameStream(a: StreamingProgress, b: StreamingProgress): boolean {
  if (a.type === "assistant_delta" && b.type === "assistant_delta")
    return a.messageId === b.messageId && a.contentIndex === b.contentIndex && a.kind === b.kind
  return a.type === "item_updated" && b.type === "item_updated" && a.item.id === b.item.id
}

/**
 * 一个已获取的 AgentSession 的会话运行时。
 *
 * 冲突操作（并发 prompt、idle 时 steer/setModel/setThinking）按协议拒绝，
 * 不排队。phase 由 AgentSession 状态推导；branch_summary 与 compaction
 * 共享 isCompacting（Pi 未暴露区分 API），统一按 compaction 展示。
 */
export class PiHostSession implements SessionRuntime {
  private readonly projection = new TranscriptProjection()
  private readonly listeners = new Set<(event: SessionRuntimeEvent) => void>()
  private readonly unsubscribeSession: () => void
  private revision = 0
  private busy: Promise<void> | undefined
  private disposed = false
  private readonly timing: TurnTimingRecorder
  private readonly ui = new ExtensionUiBridge((request) =>
    this.emit({ type: "extension_ui", request }),
  )
  private pendingProgress: StreamingProgress[] = []
  private pendingUpdateTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly session: AgentSession,
    private readonly onDispose?: () => void,
    private readonly attachments?: AttachmentSink,
  ) {
    this.timing = new TurnTimingRecorder(session.sessionManager)
    this.unsubscribeSession = session.subscribe((event) => this.handleEvent(event))
  }

  contextUsage(previewKey?: ContextPreviewKey) {
    return estimateContextUsage(this.session, previewKey)
  }

  /** 会话工作目录（规范化拼写）；目录白名单等权限判断用。 */
  get cwd(): string {
    return sessionWorkspace(this.session.sessionManager)
  }

  /** 会话持有的资源 loader；含扩展在会话启动后补进来的 skills。 */
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
    // 先推出合帧中的增量：快照里的在途消息已含这些文字，之后再发就会重复
    this.emitPendingUpdate()
    const inFlight = this.projection.inFlight(session.state.streamingMessage)
    // 只投影当前分支：getEntries 含被 branch 放弃的条目，会显示错误的 Transcript
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
      model: { provider: model.provider, id: model.id },
      thinkingLevel: session.thinkingLevel,
      attached: false, // 由协议层按连接状态覆盖
      // 协议层快照恒覆盖 locked，此处占位
      locked: false,
      revision: this.revision,
      // 全文走 platform HTTP；只带正在生成的那条，中途挂上的连接才接得上增量
      transcript: inFlight ? [inFlight] : [],
      queuedSteer: steering.map((text, index) => ({
        id: `steer-${index}`,
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      })),
      queuedSteerCount: steering.length,
    }
  }

  getPhase(): SessionPhase {
    const { session } = this

    if (session.isCompacting) return "compaction"

    if (session.retryAttempt > 0) return "retry"

    if (session.isStreaming) return "turn"
    return "idle"
  }

  async prompt(input: PromptInput): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("A prompt is already running")
      // 先取暂存附件：busy 已提前拒绝，取走后 prompt 失败要放回，避免附件静默丢失
      const staged = this.attachments?.take(this.session.sessionId) ?? []
      const expanded = expandFileMentions(
        input.text,
        canonicalizePath(this.session.sessionManager.getCwd()),
      )
      // 无 @token 时同步短路，prompt 的 timing.start 保持同一拍
      const text = expanded instanceof Promise ? await expanded : expanded
      this.timing.start()

      try {
        const binding = sessionBinding(this.session.sessionManager.getEntries())
        const composed = composePrompt(
          text,
          binding ? await uploadAttachments(binding, staged) : staged,
        )

        await this.session.prompt(
          composed.text,
          composed.images.length ? { images: composed.images } : undefined,
        )

        await this.session.waitForIdle()
      } catch (error) {
        this.attachments?.restore(this.session.sessionId, staged)
        this.timing.outcome("error")
        throw error
      } finally {
        this.timing.finish()
        this.broadcastSnapshot()
      }
    })
  }

  async steer(input: SteerInput): Promise<void> {
    // steer 是 turn 阶段的合法操作（向运行中的 prompt 追加指令），不与 prompt 互斥；
    // 只拒绝 idle 时的无意义 steer。AgentSession.steer 仅入队，并发安全。
    if (this.session.isIdle) throw new SessionBusyError("There is no active prompt to steer")

    // 与 prompt 同一条 @ 展开路径，运行中追加的文件引用同样内联
    const expanded = expandFileMentions(
      input.text,
      canonicalizePath(this.session.sessionManager.getCwd()),
    )
    const text = expanded instanceof Promise ? await expanded : expanded

    // 读文件期间 turn 可能已结束，steer 会在空闲会话里静默排队
    if (this.session.isIdle) throw new SessionBusyError("There is no active prompt to steer")
    await this.session.steer(text)
  }

  async abort(): Promise<void> {
    // AgentSession.abort 在 idle 时安全返回，无需 busy 检查
    this.timing.outcome("aborted")
    await this.session.abort()
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

  /** 改 live AgentSession 的显示名，避免 listMetadata 用空 snapshot.name 盖掉磁盘名。 */
  setSessionName(name: string): void {
    this.session.setSessionName(name)
  }

  subscribe(listener: (event: SessionRuntimeEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 把扩展接到 web 的 ctx.ui；能力边界照 pi RPC 模式。 */
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

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.ui.cancelAll()
    // 照 pi 自己的收尾：先让扩展收到 session_shutdown 释放监听与子进程，再 dispose
    const runner = this.session.extensionRunner

    if (runner.hasHandlers("session_shutdown"))
      await runner
        .emit({ type: "session_shutdown", reason: "quit" })
        .catch((error: unknown) => console.error("session_shutdown failed:", error))
    this.unsubscribeSession()
    this.clearPendingUpdate()
    this.session.dispose()
    this.listeners.clear()
    this.onDispose?.()
  }

  /** 互斥操作：冲突操作直接拒绝（协议要求 reject rather than queue）。 */
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

  private handleEvent(event: AgentSessionEvent): void {
    if (event.type === "message_end") {
      if (event.message.role === "user") this.timing.user(event.message.timestamp)

      if (event.message.role === "assistant") {
        const reason = event.message.stopReason
        this.timing.outcome(
          reason === "aborted" ? "aborted" : reason === "error" ? "error" : "complete",
        )
      }
    }

    const progress = this.projection.progress(event)

    if (progress) this.forwardProgress(progress)

    if (event.type === "message_end") {
      // 官方在通知订阅者之后才持久化 message_end；延迟一拍广播，保证快照
      // 已包含该条目，否则客户端会用旧快照重建并清掉刚收到的 progress。
      queueMicrotask(() => {
        this.timing.persistStart()
        this.broadcastSnapshot()
      })
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

  /** 最新条目的时间戳；解析失败或空会话时退回创建时间。 */
  private sessionUpdatedAt(entries: readonly { timestamp: string }[], createdAt: number): number {
    const last = entries[entries.length - 1]

    if (!last) return createdAt
    const parsed = Date.parse(last.timestamp)
    return Number.isFinite(parsed) ? parsed : createdAt
  }
}
