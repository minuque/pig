/** web 与 gateway 之间的 WebSocket 消息与 HTTP 数据形状；只有类型，没有运行时代码。 */
export type { ExtensionUiDialog, ExtensionUiRequest, ExtensionUiResponse } from "./extension-ui.js"

export type { ModelMetadata, ModelRef, ThinkingLevel } from "./model.js"

export type {
  CustomModelInput,
  CustomProviderInput,
  DefaultModelView,
  LoginEvent,
  LoginPrompt,
  ModelParamsPatch,
  ProviderListResponse,
  ProviderModelView,
  ProviderSource,
  ProviderTestResult,
  ProviderView,
} from "./provider.js"

export type {
  ContextPreviewKey,
  ContextUsageEstimate,
  ContextUsagePreview,
  SessionCard,
  TurnTiming,
} from "./session.js"

export type {
  AssistantTranscriptItem,
  JsonValue,
  TaskTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  TranscriptProgress,
  Usage,
  UserTranscriptItem,
} from "./transcript.js"

export type {
  ClientMessage,
  Command,
  CommandResult,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolVersion,
  ServerEvent,
  ServerMessage,
  ServerSnapshot,
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
} from "./wire.js"

export type {
  ComposerCommand,
  EnvironmentInfo,
  FileSearchEntry,
  FileStatResponse,
  FileTextResponse,
} from "./workspace.js"

export type { AgentTask, Task, TaskDetails, TaskStatus } from "./task.js"

export type { BashTask, TaskStopEvent, TasksEvent } from "./task.js"
