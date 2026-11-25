/** web 与 gateway 之间的共享协议契约、常量与纯函数。 */
export {
  INLINE_IMAGE_MIME_PATTERN,
  MAX_BATCH_ITEMS,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "./attachments.js"

export {
  collectContextReferences,
  CONTEXT_LABEL_MAX,
  CONTEXT_REFERENCE_MIME,
  contextReferenceAt,
  contextTextForDisplay,
  formatContextReference,
  parseContextText,
  projectContextForAgent,
  READ_SESSION_TOOL,
  REPLY_COMMENT_MAX,
  REPLY_QUOTE_MAX,
  replyLabel,
  replyReference,
  sanitizeContextLabel,
  sessionReference,
  splitContextEnvelope,
  splitContextText,
  withReplyComment,
  type ContextReference,
  type ContextReferenceMatch,
  type ContextTextSegment,
  type ReplyReference,
  type SessionReference,
} from "./context-reference.js"

export type { ExtensionUiDialog, ExtensionUiRequest, ExtensionUiResponse } from "./extension-ui.js"

export type {
  PlatformHttpRouteKey,
  PlatformHttpRoutes,
  PlatformHttpRouteSpec,
  PlatformRouteBody,
  PlatformRouteParams,
  PlatformRouteQuery,
  PlatformRouteResponse,
} from "./http.js"

export type { ModelChannels, ModelMetadata, ModelRef, ThinkingLevel } from "./model.js"

export type {
  UserChatWidth,
  UserLocale,
  UserPreferences,
  UserPreferencesPatch,
  UserRailLayout,
  UserRailSection,
  UserThemeMode,
  UserDensity,
  UserWelcomeField,
} from "./preferences.js"

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
  ContextUsageTokens,
  SessionCard,
  WorkspaceGit,
  SessionTranscriptPage,
  TurnTiming,
  SessionArchives,
  SessionArchivesPatch,
} from "./session.js"

export type {
  AssistantTranscriptItem,
  JsonValue,
  SystemEvent,
  SystemTranscriptItem,
  TaskTranscriptItem,
  ToolTranscriptItem,
  TranscriptItem,
  TranscriptProgress,
  Usage,
  UserTranscriptItem,
} from "./transcript.js"

export { WEBSOCKET_PATH } from "./wire.js"

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
  SessionActivity,
  SessionMetadata,
  SessionPhase,
  SessionSnapshot,
} from "./wire.js"

export {
  isPreviewLinkMessage,
  PREVIEW_LINK_MESSAGE_TYPE,
  type PreviewLinkMessage,
} from "./workspace.js"

export { canonicalizeWorkspacePath } from "./workspace-path.js"

export type {
  ComposerCommand,
  ContentSearchMatch,
  ContentSearchResponse,
  DirectoryEntry,
  DirectoryListResponse,
  FileSearchEntry,
  FileStatResponse,
  SearchTruncation,
  FileTextResponse,
} from "./workspace.js"

export type { AgentTask, Task, TaskDetails, TaskStatus } from "./task.js"

export type { BashTask, TaskChannels, TaskStopEvent, TasksEvent } from "./task.js"
