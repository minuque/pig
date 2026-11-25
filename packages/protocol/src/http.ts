/** 平台 HTTP 契约：键是「方法 路径」，路径里的 :name 由 params 填。只有类型，没有运行时代码。 */
import type {
  McpExposure,
  McpProbeReport,
  McpScopeView,
  SkillFileView,
  SkillScopeView,
} from "./agent-config.js"
import type { ModelMetadata } from "./model.js"
import type {
  CustomProviderInput,
  DefaultModelView,
  ModelParamsPatch,
  ProviderListResponse,
  ProviderTestResult,
} from "./provider.js"
import type {
  ContextUsageEstimate,
  ContextUsagePreview,
  SessionCard,
  SessionTranscriptPage,
  SessionArchives,
  SessionArchivesPatch,
} from "./session.js"
import type { TranscriptItem } from "./transcript.js"
import type { UserPreferences, UserPreferencesPatch } from "./preferences.js"
import type {
  ComposerCommand,
  ContentSearchResponse,
  DirectoryListResponse,
  FileSearchEntry,
  FileStatResponse,
  FileTextResponse,
} from "./workspace.js"

/** 一个端点的声明：params 是路径参数，query 一律字符串，body 是 JSON 形状。 */
export interface PlatformHttpRouteSpec {
  params?: Record<string, string>
  query?: Record<string, string | undefined>
  body?: unknown
  response?: unknown
  /** 原始字节或 SSE：handler 自己写 res，没有 JSON 响应。 */
  stream?: true
}

export interface PlatformHttpRoutes {
  "POST /api/v1/platform/select-directory": {
    /** 不带 body 也能问：交互式平台会回要求手输。 */
    body: { path?: string } | undefined
    response: { path: string | null; requiresManualInput: boolean }
  }
  "POST /api/v1/platform/warm-workspace": {
    body: { path: string }
    response: { ok: true }
  }
  "GET /api/v1/platform/session-cards": { response: { cards: SessionCard[] } }
  "GET /api/v1/platform/context-usage": {
    query: { sessionId: string; preview?: string }
    response: { usage: ContextUsageEstimate | null; preview: ContextUsagePreview | null }
  }
  "GET /api/v1/platform/transcript/item": {
    query: { sessionId: string; id: string }
    response: { item: TranscriptItem }
  }
  "GET /api/v1/platform/transcript": {
    query: { sessionId: string; known?: string; after?: string }
    response: SessionTranscriptPage
  }
  "POST /api/v1/platform/rename-session": {
    body: { id: string; name: string }
    response: { ok: true }
  }
  "POST /api/v1/platform/delete-session": {
    body: { id: string }
    response: { ok: true }
  }
  "GET /api/v1/platform/files": {
    query: { cwd: string; q: string }
    response: { entries: FileSearchEntry[] }
  }
  "GET /api/v1/platform/skills": {
    query: { cwd: string }
    response: { skills: ComposerCommand[]; prompts: ComposerCommand[] }
  }
  "POST /api/v1/platform/attachments/stage": {
    query: { batch: string; name: string; mimeType: string }
    response: { id: string }
  }
  "GET /api/v1/platform/preferences": {
    response: { preferences: UserPreferences; exists: boolean }
  }
  "PATCH /api/v1/platform/preferences": {
    body: UserPreferencesPatch
    response: { preferences: UserPreferences }
  }
  "GET /api/v1/platform/session-archives": {
    response: { archives: SessionArchives; exists: boolean }
  }
  "PATCH /api/v1/platform/session-archives": {
    body: SessionArchivesPatch
    response: { archives: SessionArchives }
  }
  "POST /api/v1/platform/attachments/discard": {
    body: { batch: string }
    response: { ok: true }
  }
  "GET /api/v1/platform/fs/stat": {
    query: { cwd: string; path: string }
    response: FileStatResponse
  }
  "GET /api/v1/platform/fs/text": {
    query: { cwd: string; path: string; force?: string }
    response: FileTextResponse
  }
  "GET /api/v1/platform/fs/raw": {
    query: { cwd: string; path: string }
    stream: true
  }
  "GET /api/v1/platform/fs/list": {
    query: { cwd: string; path: string }
    response: DirectoryListResponse
  }
  "GET /api/v1/platform/fs/search": {
    query: { cwd: string; q: string }
    response: ContentSearchResponse
  }
  "GET /api/v1/platform/fs/preview-token": {
    query: { cwd: string }
    response: { token: string }
  }
  "GET /api/v1/platform/providers": { response: ProviderListResponse }
  "POST /api/v1/platform/providers/refresh": { response: ProviderListResponse }
  "GET /api/v1/platform/models": {
    response: { models: ModelMetadata[]; defaultModel: DefaultModelView | null }
  }
  "POST /api/v1/platform/providers/login": {
    body: { providerId: string; type: "api_key" | "oauth" }
    response: { loginId: string }
  }
  "POST /api/v1/platform/providers/test": {
    body: { providerId: string; modelId?: string }
    response: ProviderTestResult
  }
  "GET /api/v1/platform/providers/login/:loginId/events": {
    params: { loginId: string }
    query: { after?: string }
    stream: true
  }
  "POST /api/v1/platform/providers/login/:loginId/responses": {
    params: { loginId: string }
    body: { value: string }
    response: { ok: true }
  }
  "POST /api/v1/platform/providers/login/:loginId/cancel": {
    params: { loginId: string }
    response: { ok: true }
  }
  "POST /api/v1/platform/providers/logout": {
    body: { providerId: string }
    response: { ok: true }
  }
  "GET /api/v1/platform/providers/:providerId/key": {
    params: { providerId: string }
    response: { key: string }
  }
  "PUT /api/v1/platform/providers/custom/:providerId": {
    params: { providerId: string }
    body: CustomProviderInput
    response: { ok: true }
  }
  "DELETE /api/v1/platform/providers/custom/:providerId": {
    params: { providerId: string }
    response: { ok: true }
  }
  "PUT /api/v1/platform/providers/:providerId/models/:modelId/params": {
    params: { providerId: string; modelId: string }
    body: ModelParamsPatch
    response: { ok: true }
  }
  "PUT /api/v1/platform/providers/:providerId/models/:modelId/enabled": {
    params: { providerId: string; modelId: string }
    body: { enabled: boolean }
    response: { ok: true }
  }
  "GET /api/v1/platform/mcp": { query: { scope: string }; response: McpScopeView }
  "PUT /api/v1/platform/mcp/server": {
    body: {
      scope: string
      name: string
      previousName?: string
      overwrite?: boolean
      config: Record<string, unknown>
    }
    response: { ok: true } | { ok: false; error: string }
  }
  "PATCH /api/v1/platform/mcp/server": {
    body: { scope: string; name: string; enabled?: boolean; exposure?: McpExposure }
    response: { ok: true }
  }
  "DELETE /api/v1/platform/mcp/server": {
    body: { scope: string; name: string }
    response: { ok: true }
  }
  "GET /api/v1/platform/mcp/probes": {
    query: { scope: string }
    response: McpProbeReport
  }
  "POST /api/v1/platform/mcp/probe": {
    body: { scope: string }
    response: McpProbeReport
  }
  "POST /api/v1/platform/mcp/login": {
    body: { scope: string; name: string }
    response: { loginId: string }
  }
  "GET /api/v1/platform/mcp/login/:loginId/events": {
    params: { loginId: string }
    query: { after?: string }
    stream: true
  }
  "POST /api/v1/platform/mcp/login/:loginId/cancel": {
    params: { loginId: string }
    response: { ok: true }
  }
  "POST /api/v1/platform/mcp/logout": {
    body: { scope: string; name: string }
    response: { ok: true }
  }
  "GET /api/v1/platform/skill-settings": { query: { scope: string }; response: SkillScopeView }
  "GET /api/v1/platform/skill-settings/file": {
    query: { scope: string; path: string }
    response: SkillFileView
  }
  "PUT /api/v1/platform/skill-settings/file": {
    body: { scope: string; path: string; raw: string }
    response: { ok: true } | { ok: false; error: string }
  }
  "POST /api/v1/platform/skill-settings": {
    body: { scope: string; name: string; description: string }
    response: { filePath: string } | { error: string }
  }
  "PATCH /api/v1/platform/skill-settings/enabled": {
    body: { scope: string; filePath: string; enabled: boolean }
    response: { ok: true }
  }
  "DELETE /api/v1/platform/skill-settings": {
    body: { scope: string; path: string }
    response: { ok: true }
  }
}

export type PlatformHttpRouteKey = keyof PlatformHttpRoutes

type Spec<K extends PlatformHttpRouteKey> = PlatformHttpRoutes[K]

export type PlatformRouteParams<K extends PlatformHttpRouteKey> =
  Spec<K> extends { params: infer P } ? P : Record<string, never>

export type PlatformRouteQuery<K extends PlatformHttpRouteKey> =
  Spec<K> extends { query: infer Q } ? Q : Record<string, never>

export type PlatformRouteBody<K extends PlatformHttpRouteKey> =
  Spec<K> extends { body: infer B } ? B : never

export type PlatformRouteResponse<K extends PlatformHttpRouteKey> =
  Spec<K> extends { stream: true } ? void : Spec<K> extends { response: infer R } ? R : void
