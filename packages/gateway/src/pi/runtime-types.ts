import type {
  ExtensionUiDialog,
  ExtensionUiRequest,
  ExtensionUiResponse,
  DefaultModelView,
  ModelMetadata,
  ModelRef,
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
  ThinkingLevel,
  TranscriptProgress,
  ProtocolErrorCode,
} from "@pig/protocol"

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

/** 运行时投影：attached 与 locked 由 Gateway 按连接状态补齐。 */
export type SessionSnapshotDraft = Omit<SessionSnapshot, "attached" | "locked">

export type PromptInput = { text: string; attachmentBatch?: string }

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

export interface SessionRuntime {
  snapshot(): SessionSnapshotDraft | Promise<SessionSnapshotDraft>
  getPhase(): SessionPhase
  prompt(input: PromptInput): Promise<void>
  steer(input: SteerInput): Promise<void>
  abort(): Promise<void>
  setModel(model: ModelRef): Promise<void>
  setThinking(thinkingLevel: ThinkingLevel): Promise<void>
  subscribe(listener: (event: SessionRuntimeEvent) => void): () => void
  respondExtensionUi(response: ExtensionUiResponse): void
  extensionDialogs(): ExtensionUiDialog[]
  stopTask(taskId: string): void
  hasRunningTasks(): boolean
  dispose(): Promise<void>
}

export interface SessionService {
  listSessions(): Promise<SessionMetadata[]>
  listModels(): Promise<{ models: ModelMetadata[]; defaultModel: DefaultModelView | null }>
  createSession(options: CreateSessionOptions): Promise<SessionRuntime>
  openSession(sessionId: string, options?: { takeover?: boolean }): Promise<SessionRuntime>
  watchSession(sessionId: string, listener: () => void): () => void
}
