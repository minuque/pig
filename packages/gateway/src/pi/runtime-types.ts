import type {
  ExtensionUiDialog,
  ExtensionUiRequest,
  ExtensionUiResponse,
  ModelMetadata,
  ModelRef,
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
  TranscriptProgress,
  ProtocolErrorCode,
} from "@pig/protocol"

/** 带协议错误码的失败；协议层原样转给客户端，其余异常一律报 internal_error。 */
export class GatewayError extends Error {
  constructor(
    readonly code: ProtocolErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "GatewayError"
  }
}

export class SessionBusyError extends GatewayError {
  constructor(message = "Session is busy") {
    super("busy", message)
  }
}

export class SessionNotFoundError extends GatewayError {
  constructor(message = "Session was not found") {
    super("not_found", message)
  }
}

export type PromptInput = { text: string }

export type SteerInput = { text: string }

export interface CreateSessionOptions {
  id: string
  cwd?: string
  name?: string
  model?: ModelRef
  thinkingLevel?: ThinkingLevel
}

export type SessionRuntimeEvent =
  | { type: "snapshot" }
  | { type: "progress"; progress: TranscriptProgress }
  | { type: "error"; error: GatewayError }
  | { type: "extension_ui"; request: ExtensionUiRequest }

/** 一个已打开会话的运行时：协议层只经它读快照、下命令、收事件。 */
export interface SessionRuntime {
  snapshot(): SessionSnapshot | Promise<SessionSnapshot>
  getPhase(): SessionPhase
  prompt(input: PromptInput): Promise<void>
  steer(input: SteerInput): Promise<void>
  abort(): Promise<void>
  setModel(model: ModelRef): Promise<void>
  setThinking(thinkingLevel: ThinkingLevel): Promise<void>
  subscribe(listener: (event: SessionRuntimeEvent) => void): () => void
  /** 扩展对话框的回答；未知 id 忽略。 */
  respondExtensionUi(response: ExtensionUiResponse): void
  /** 还在等回答的扩展对话框，新挂上的连接要补收。 */
  extensionDialogs(): ExtensionUiDialog[]
  /** 请求停止一个后台任务；未知 id 忽略。 */
  stopTask(taskId: string): void
  /** 有后台任务在跑：这样的会话没人连着也不销毁。 */
  hasRunningTasks(): boolean
  dispose(): Promise<void>
}

/** 会话目录与打开入口。 */
export interface SessionService {
  listSessions(): Promise<SessionMetadata[]>
  listModels(): Promise<ModelMetadata[]>
  createSession(options: CreateSessionOptions): Promise<SessionRuntime>
  openSession(sessionId: string): Promise<SessionRuntime>
}
