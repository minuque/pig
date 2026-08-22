import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type {
  ModelRef,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
} from "@earendil-works/pi-protocol";
import { PiServerError, SessionBusyError } from "@earendil-works/pi-server";
import type {
  PiSessionRuntime,
  PiSessionRuntimeEvent,
  PromptInput,
  SteerInput,
} from "@earendil-works/pi-server";
import { TranscriptProjection, windowSnapshotTranscript } from "./transcript.js";

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
]);

/**
 * 一个已获取的 AgentSession 的 PiServer 运行时。
 *
 * 冲突操作（并发 prompt、idle 时 steer/setModel/setThinking）按协议拒绝，
 * 不排队。phase 由 AgentSession 状态推导；branch_summary 与 compaction
 * 共享 isCompacting（Pi 未暴露区分 API），统一按 compaction 展示。
 */
export class PiHostSession implements PiSessionRuntime {
  private readonly projection = new TranscriptProjection();
  private readonly listeners = new Set<(event: PiSessionRuntimeEvent) => void>();
  private readonly unsubscribeSession: () => void;
  private revision = 0;
  private busy: Promise<void> | undefined;
  private disposed = false;

  constructor(private readonly session: AgentSession) {
    this.unsubscribeSession = session.subscribe((event) => this.handleEvent(event));
  }

  snapshot(): SessionSnapshot {
    const { session } = this;
    const model = session.model;
    if (!model) throw new Error("Session has no active model");
    const manager = session.sessionManager;
    // 只投影当前分支：getEntries 含被 branch 放弃的条目，会显示错误的 Transcript
    const entries = manager.getBranch();
    const createdAt = this.sessionCreatedAt();
    const steering = session.getSteeringMessages();
    return {
      id: session.sessionId,
      ...(session.sessionName === undefined ? {} : { name: session.sessionName }),
      cwd: manager.getCwd(),
      createdAt,
      updatedAt: this.sessionUpdatedAt(entries, createdAt),
      phase: this.getPhase(),
      model: { provider: model.provider, id: model.id },
      thinkingLevel: session.thinkingLevel,
      attached: false, // 由 PiServer 按连接状态覆盖
      // PiServer 的 normalizedSnapshot 恒覆盖 locked，此处占位
      locked: false,
      revision: this.revision,
      // 首包只带最近一页；更早的走 platform/transcript。磁盘仍是全文。
      transcript: windowSnapshotTranscript(this.projection.transcript(entries)),
      queuedSteer: steering.map((text, index) => ({
        id: `steer-${index}`,
        role: "user",
        content: [{ type: "text", text }],
        timestamp: Date.now(),
      })),
      queuedSteerCount: steering.length,
    };
  }

  getPhase(): SessionPhase {
    const { session } = this;
    if (session.isCompacting) return "compaction";
    if (session.retryAttempt > 0) return "retry";
    if (session.isStreaming) return "turn";
    return "idle";
  }

  async prompt(input: PromptInput): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("A prompt is already running");
      await this.session.prompt(input.text);
      if (!this.session.isIdle) await this.session.waitForIdle();
    });
  }

  async steer(input: SteerInput): Promise<void> {
    // steer 是 turn 阶段的合法操作（向运行中的 prompt 追加指令），不与 prompt 互斥；
    // 只拒绝 idle 时的无意义 steer。AgentSession.steer 仅入队，并发安全。
    if (this.session.isIdle) throw new SessionBusyError("There is no active prompt to steer");
    await this.session.steer(input.text);
  }

  async abort(): Promise<void> {
    // AgentSession.abort 在 idle 时安全返回，无需 busy 检查
    await this.session.abort();
  }

  async setModel(model: ModelRef): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("Session is busy");
      const resolved = this.session.modelRuntime.getModel(model.provider, model.id);
      if (!resolved) {
        throw new PiServerError(
          "invalid_request",
          `Model ${model.provider}/${model.id} is unavailable`,
        );
      }
      await this.session.setModel(resolved);
    });
  }

  async setThinking(thinkingLevel: ThinkingLevel): Promise<void> {
    await this.exclusive(async () => {
      if (!this.session.isIdle) throw new SessionBusyError("Session is busy");
      this.session.setThinkingLevel(thinkingLevel);
    });
  }

  subscribe(listener: (event: PiSessionRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeSession();
    this.session.dispose();
    this.listeners.clear();
  }

  /** 互斥操作：冲突操作直接拒绝（协议要求 reject rather than queue）。 */
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.busy) throw new SessionBusyError("Session is busy");
    const run = operation();
    this.busy = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await run;
    } finally {
      this.busy = undefined;
    }
  }

  private handleEvent(event: AgentSessionEvent): void {
    const progress = this.projection.progress(event);
    if (progress) {
      this.revision += 1;
      this.emit({ type: "progress", progress });
    }
    if (event.type === "message_end") {
      // 官方在通知订阅者之后才持久化 message_end；延迟一拍广播，保证快照
      // 已包含该条目，否则客户端会用旧快照重建并清掉刚收到的 progress。
      queueMicrotask(() => this.broadcastSnapshot());
      return;
    }
    if (!SNAPSHOT_SKIP_EVENTS.has(event.type)) this.broadcastSnapshot();
  }

  private broadcastSnapshot(): void {
    this.revision += 1;
    this.emit({ type: "snapshot" });
  }

  private emit(event: PiSessionRuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private sessionCreatedAt(): number {
    const header = this.session.sessionManager.getHeader();
    const timestamp = header?.timestamp;
    if (timestamp === undefined) return Date.now();
    const parsed = Date.parse(timestamp);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  /** 最新条目的时间戳；解析失败或空会话时退回创建时间。 */
  private sessionUpdatedAt(entries: readonly { timestamp: string }[], createdAt: number): number {
    const last = entries[entries.length - 1];
    if (!last) return createdAt;
    const parsed = Date.parse(last.timestamp);
    return Number.isFinite(parsed) ? parsed : createdAt;
  }
}
