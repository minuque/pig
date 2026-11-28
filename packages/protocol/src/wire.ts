import type { AskAnswer, ExtensionUiRequest, ExtensionUiResponse } from "./extension-ui.js"
import type { ModelMetadata, ModelRef, ThinkingLevel } from "./model.js"
import type { DefaultModelView } from "./provider.js"
import type { UserPreferences } from "./preferences.js"
import type { SessionArchives, WorkspaceGit } from "./session.js"
import type { Task } from "./task.js"
import type {
  SystemTranscriptItem,
  TranscriptItem,
  TranscriptProgress,
  UserTranscriptItem,
} from "./transcript.js"

/** 协议版本；两端写字面量 1，类型保证一致。 */
export type ProtocolVersion = 1

export const WEBSOCKET_PATH = "/api/v1/pi"

export type SessionPhase = "idle" | "turn" | "compaction" | "branch_summary" | "retry"

/** 进行中的重试或压缩；retryAt 是下次重试的时间戳。 */
export type SessionActivity =
  | { kind: "retry"; attempt: number; maxAttempts: number; retryAt: number; errorMessage: string }
  | { kind: "compaction"; reason: "manual" | "threshold" | "overflow" }

export interface SessionMetadata {
  id: string
  createdAt: number
  updatedAt?: number
  parentSessionId?: string
  sessionName?: string
  cwd?: string
}

export interface SessionSnapshot {
  id: string
  name?: string
  cwd: string
  createdAt: number
  updatedAt: number
  phase: SessionPhase
  activity?: SessionActivity
  model: ModelRef
  thinkingLevel: ThinkingLevel
  attached: boolean
  locked: boolean
  revision: number
  transcript: TranscriptItem[]
  queuedSteer: UserTranscriptItem[]
  queuedSteerCount: number
  tasks: Task[]
  notices: SystemTranscriptItem[]
}

export interface ServerSnapshot {
  serverId: string
  protocolVersion: ProtocolVersion
  revision: number
  sessions: SessionMetadata[]
  models: ModelMetadata[]
  defaultModel: DefaultModelView | null
  workspaceGit: Record<string, WorkspaceGit>
}

/** 会话命令名照 pi RPC（prompt / steer / abort / set_model / set_thinking_level）；会话路由是 pig 自己的。 */
export type Command =
  | { command: "list_sessions" }
  | {
      command: "create_session"
      cwd?: string
      name?: string
      model?: ModelRef
      thinkingLevel?: ThinkingLevel
    }
  | { command: "attach_session"; sessionId: string; takeover?: boolean }
  | { command: "detach_session"; sessionId: string }
  /** prompt 可带一个附件 batch：Gateway 按 batch 原子消费已 stage 的附件。 */
  | { command: "prompt"; sessionId: string; message: string; attachmentBatch?: string }
  | { command: "steer"; sessionId: string; message: string }
  | { command: "abort"; sessionId: string }
  | { command: "set_model"; sessionId: string; model: ModelRef }
  | { command: "set_thinking_level"; sessionId: string; level: ThinkingLevel }
  /** 手动压缩上下文；instructions 是压缩时要保留的重点。 */
  | { command: "compact"; sessionId: string; instructions?: string }
  /** 重新加载扩展、技能、提示词模板与上下文文件。 */
  | { command: "reload"; sessionId: string }
  | { command: "extension_ui_response"; sessionId: string; response: ExtensionUiResponse }
  | { command: "stop_task"; sessionId: string; taskId: string }
  | { command: "record_ask_answers"; sessionId: string; toolCallId: string; answers: AskAnswer[] }
  /** 按需盯住一个会话文件：外部进程（如 Pi TUI）往里追加时推 session_file_changed。 */
  | { command: "watch_session"; sessionId: string }
  | { command: "unwatch_session"; sessionId: string }
  | { command: "refresh_workspace_git" }

export type CommandResult =
  | { command: "list_sessions"; sessions: SessionMetadata[] }
  | { command: "detach_session"; sessionId: string }
  | { command: "extension_ui_response"; sessionId: string }
  | { command: "watch_session"; sessionId: string }
  | { command: "unwatch_session"; sessionId: string }
  | { command: "refresh_workspace_git" }
  | {
      command: Exclude<
        Command["command"],
        | "list_sessions"
        | "detach_session"
        | "extension_ui_response"
        | "watch_session"
        | "unwatch_session"
        | "refresh_workspace_git"
      >
      session: SessionSnapshot
    }

export type ProtocolErrorCode =
  | "version"
  | "busy"
  | "session_locked"
  /** 会话文件在 pig 持有期间被别处追加：运行时已释放，重拉历史后再发。 */
  | "session_changed_elsewhere"
  | "not_found"
  | "invalid_request"
  | "not_implemented"
  | "internal_error"

export interface ProtocolError {
  code: ProtocolErrorCode
  message: string
}

export type ClientMessage =
  { type: "hello"; version: ProtocolVersion } | { type: "request"; id: string; command: Command }

export type ServerEvent =
  | { type: "server_snapshot"; snapshot: ServerSnapshot }
  | { type: "session_snapshot"; snapshot: SessionSnapshot }
  | { type: "session_progress"; sessionId: string; progress: TranscriptProgress }
  | { type: "extension_ui_request"; sessionId: string; request: ExtensionUiRequest }
  /** 会话文件变了（外部追加、改名或删除）：客户端自己决定要不要重拉历史。 */
  | { type: "session_file_changed"; sessionId: string }
  | { type: "preferences_changed"; preferences: UserPreferences }
  | { type: "session_archives_changed"; archives: SessionArchives }
  | { type: "workspace_git_changed"; changes: Record<string, WorkspaceGit | null> }

export type ServerMessage =
  | { type: "hello"; snapshot: ServerSnapshot }
  | { type: "hello_error"; error: ProtocolError }
  | { type: "response"; id: string; ok: true; result: CommandResult }
  | { type: "response"; id: string; ok: false; error: ProtocolError }
  | { type: "event"; event: ServerEvent }
