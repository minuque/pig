import type { ModelMetadata, ModelRef, ThinkingLevel } from "./model.js"
import type { TranscriptItem, TranscriptProgress, UserTranscriptItem } from "./transcript.js"

/** 协议版本；两端写字面量 1，类型保证一致。 */
export type ProtocolVersion = 1

export type SessionPhase = "idle" | "turn" | "compaction" | "branch_summary" | "retry"

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
  model: ModelRef
  thinkingLevel: ThinkingLevel
  /** 当前连接是否挂在这个会话上。 */
  attached: boolean
  locked: boolean
  revision: number
  transcript: TranscriptItem[]
  queuedSteer: UserTranscriptItem[]
  queuedSteerCount: number
}

export interface ServerSnapshot {
  serverId: string
  protocolVersion: ProtocolVersion
  revision: number
  sessions: SessionMetadata[]
  models: ModelMetadata[]
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
  | { command: "attach_session"; sessionId: string }
  | { command: "detach_session"; sessionId: string }
  | { command: "prompt"; sessionId: string; message: string }
  | { command: "steer"; sessionId: string; message: string }
  | { command: "abort"; sessionId: string }
  | { command: "set_model"; sessionId: string; model: ModelRef }
  | { command: "set_thinking_level"; sessionId: string; level: ThinkingLevel }

export type CommandResult =
  | { command: "list_sessions"; sessions: SessionMetadata[] }
  | { command: "detach_session"; sessionId: string }
  | {
      command: Exclude<Command["command"], "list_sessions" | "detach_session">
      session: SessionSnapshot
    }

export type ProtocolErrorCode =
  | "version"
  | "busy"
  | "session_locked"
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

export type ServerMessage =
  | { type: "hello"; snapshot: ServerSnapshot }
  | { type: "hello_error"; error: ProtocolError }
  | { type: "response"; id: string; ok: true; result: CommandResult }
  | { type: "response"; id: string; ok: false; error: ProtocolError }
  | { type: "event"; event: ServerEvent }
