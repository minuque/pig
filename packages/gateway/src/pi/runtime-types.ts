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
  snapshot(): SessionSnapshot | Promise<SessionSnapshot>
  getPhase(): SessionPhase
  prompt(input: PromptInput): Promise<void>
  steer(input: SteerInput): Promise<void>
  abort(): Promise<void>
  setModel(model: ModelRef): Promise<void>
  setThinking(thinkingLevel: ThinkingLevel): Promise<void>
  compact(instructions?: string): Promise<void>
  reload(): Promise<void>
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
