import { PlatformRequestError, platformRequest } from "@client/http.js"
import type {
  ComposerCommand,
  ContentSearchResponse,
  ContextUsageEstimate,
  ContextUsagePreview,
  CustomProviderInput,
  DefaultModelView,
  DirectoryListResponse,
  EnvironmentInfo,
  FileSearchEntry,
  FileStatResponse,
  FileTextResponse,
  LoginEvent,
  ModelMetadata,
  ModelParamsPatch,
  PlatformHttpRouteKey,
  PlatformRouteBody,
  PlatformRouteParams,
  PlatformRouteQuery,
  PlatformRouteResponse,
  ProviderListResponse,
  ProviderTestResult,
  SessionCard,
  WorkspaceGit,
  SessionTranscriptPage,
  TranscriptItem,
  TurnTiming,
  SessionArchives,
  SessionArchivesPatch,
  UserPreferences,
  UserPreferencesPatch,
} from "@/types/common-type.js"

type HasOptions<K extends PlatformHttpRouteKey> = [PlatformRouteBody<K>] extends [never]
  ? [PlatformRouteParams<K>] extends [Record<string, never>]
    ? false
    : true
  : true

type RequestOptions<K extends PlatformHttpRouteKey> = {
  signal?: AbortSignal
  headers?: Record<string, string>
  query?: PlatformRouteQuery<K>
} & ([PlatformRouteBody<K>] extends [never] ? { body?: never } : { body: PlatformRouteBody<K> }) &
  ([PlatformRouteParams<K>] extends [Record<string, never>]
    ? { params?: never }
    : { params: PlatformRouteParams<K> })

function routeUrl<K extends PlatformHttpRouteKey>(
  route: K,
  options?: { params?: PlatformRouteParams<K>; query?: PlatformRouteQuery<K> },
): string {
  const params = (options?.params ?? {}) as Record<string, string | undefined>
  const path = route.slice(route.indexOf(" ") + 1).replace(/:[A-Za-z]\w*/g, (token) => {
    const value = params[token.slice(1)]
    return encodeURIComponent(value ?? "")
  })
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(
    (options?.query ?? {}) as Record<string, string | undefined>,
  )) {
    if (value !== undefined) search.set(key, value)
  }

  const suffix = search.toString()
  return suffix ? `${path}?${suffix}` : path
}

async function request<K extends PlatformHttpRouteKey>(
  route: K,
  ...rest: HasOptions<K> extends true ? [options: RequestOptions<K>] : [options?: RequestOptions<K>]
): Promise<PlatformRouteResponse<K>> {
  const options = rest[0]
  const body = options?.body
  return platformRequest<PlatformRouteResponse<K>>(routeUrl(route, options), {
    method: route.slice(0, route.indexOf(" ")),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(options?.signal ? { signal: options.signal } : {}),
    ...(options?.headers ? { headers: options.headers } : {}),
  })
}

export async function selectDirectory(
  path?: string,
  environment?: string,
): Promise<{ path: string | null; requiresManualInput: boolean }> {
  return request("POST /api/v1/platform/select-directory", {
    body:
      path === undefined
        ? undefined
        : { path, ...(environment === undefined ? {} : { environment }) },
  })
}

export async function listEnvironments(): Promise<EnvironmentInfo[]> {
  const { environments } = await request("GET /api/v1/platform/environments")
  return environments
}

export function getPreferences(): Promise<{ preferences: UserPreferences; exists: boolean }> {
  return request("GET /api/v1/platform/preferences")
}

export async function patchPreferences(patch: UserPreferencesPatch): Promise<UserPreferences> {
  const { preferences } = await request("PATCH /api/v1/platform/preferences", { body: patch })
  return preferences
}

export function getSessionArchives(): Promise<{ archives: SessionArchives; exists: boolean }> {
  return request("GET /api/v1/platform/session-archives")
}

export async function patchSessionArchives(patch: SessionArchivesPatch): Promise<SessionArchives> {
  const { archives } = await request("PATCH /api/v1/platform/session-archives", { body: patch })
  return archives
}

export async function warmWorkspace(path: string): Promise<void> {
  await request("POST /api/v1/platform/warm-workspace", { body: { path } })
}

export async function listSessionCards(): Promise<SessionCard[]> {
  const { cards } = await request("GET /api/v1/platform/session-cards")
  return cards
}

export async function listWorkspaceGit(): Promise<Record<string, WorkspaceGit>> {
  const { workspaces } = await request("GET /api/v1/platform/workspace-git")
  return workspaces
}

export async function listProviders(): Promise<ProviderListResponse> {
  return request("GET /api/v1/platform/providers")
}

export function listProviderModels(): Promise<{
  models: ModelMetadata[]
  defaultModel: DefaultModelView | null
}> {
  return request("GET /api/v1/platform/models")
}

export async function loginProvider(input: {
  providerId: string
  type: "api_key" | "oauth"
}): Promise<{ loginId: string }> {
  return request("POST /api/v1/platform/providers/login", { body: input })
}

export async function openLoginEvents(
  loginId: string,
  after: number,
  onEvent: (event: LoginEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const requestId = crypto.randomUUID()
  const response = await fetch(
    routeUrl("GET /api/v1/platform/providers/login/:loginId/events", {
      params: { loginId },
      query: { after: String(after) },
    }),
    { headers: { "x-request-id": requestId }, ...(signal ? { signal } : {}) },
  )

  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as { code?: string }
    throw new PlatformRequestError(body.code ?? `HTTP_${response.status}`, requestId)
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()

    if (done) break
    buffer += value

    for (let index = buffer.indexOf("\n\n"); index >= 0; index = buffer.indexOf("\n\n")) {
      const frame = buffer.slice(0, index)

      buffer = buffer.slice(index + 2)
      onEvent(parseFrame(frame))
    }
  }
}

export async function respondLogin(loginId: string, value: string): Promise<void> {
  await request("POST /api/v1/platform/providers/login/:loginId/responses", {
    params: { loginId },
    body: { value },
  })
}

export async function cancelLogin(loginId: string): Promise<void> {
  await request("POST /api/v1/platform/providers/login/:loginId/cancel", { params: { loginId } })
}

export async function logoutProvider(providerId: string): Promise<void> {
  await request("POST /api/v1/platform/providers/logout", { body: { providerId } })
}

export async function copyProviderKey(providerId: string): Promise<string> {
  const { key } = await request("GET /api/v1/platform/providers/:providerId/key", {
    params: { providerId },
  })
  return key
}

export async function testProvider(
  providerId: string,
  modelId?: string,
): Promise<ProviderTestResult> {
  return request("POST /api/v1/platform/providers/test", {
    body: { providerId, ...(modelId ? { modelId } : {}) },
  })
}

export async function saveCustomProvider(input: CustomProviderInput): Promise<void> {
  await request("PUT /api/v1/platform/providers/custom/:providerId", {
    params: { providerId: input.id },
    body: input,
  })
}

export async function deleteCustomProvider(providerId: string): Promise<void> {
  await request("DELETE /api/v1/platform/providers/custom/:providerId", {
    params: { providerId },
  })
}

export async function refreshProviderCatalog(): Promise<ProviderListResponse> {
  return request("POST /api/v1/platform/providers/refresh")
}

export async function updateModelParams(
  providerId: string,
  modelId: string,
  patch: ModelParamsPatch,
): Promise<void> {
  await request("PUT /api/v1/platform/providers/:providerId/models/:modelId/params", {
    params: { providerId, modelId },
    body: patch,
  })
}

export async function setModelEnabled(
  providerId: string,
  modelId: string,
  enabled: boolean,
): Promise<void> {
  await request("PUT /api/v1/platform/providers/:providerId/models/:modelId/enabled", {
    params: { providerId, modelId },
    body: { enabled },
  })
}

function parseFrame(frame: string): LoginEvent {
  const data = frame
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6)

  if (!data) throw new Error("bad sse frame")
  return JSON.parse(data) as LoginEvent
}

function isTurnTiming(value: unknown): value is TurnTiming {
  if (
    !value ||
    typeof value !== "object" ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !("startedAt" in value) ||
    typeof value.startedAt !== "number" ||
    !Number.isFinite(value.startedAt) ||
    !("outcome" in value)
  )
    return false

  if (value.outcome === "running") return !("endedAt" in value)
  return (
    (value.outcome === "complete" || value.outcome === "error" || value.outcome === "aborted") &&
    "endedAt" in value &&
    typeof value.endedAt === "number" &&
    Number.isFinite(value.endedAt) &&
    value.endedAt >= value.startedAt
  )
}

type FullTranscriptPage = Extract<SessionTranscriptPage, { items: unknown }>

export async function sessionTranscript(sessionId: string): Promise<FullTranscriptPage>
export async function sessionTranscript(
  sessionId: string,
  cursor: { known?: string | undefined; after?: string | undefined },
): Promise<SessionTranscriptPage>
export async function sessionTranscript(
  sessionId: string,
  { known, after }: { known?: string | undefined; after?: string | undefined } = {},
): Promise<SessionTranscriptPage> {
  const page = await request("GET /api/v1/platform/transcript", {
    query: { sessionId, ...(known ? { known } : {}), ...(after ? { after } : {}) },
  })

  if ("unchanged" in page) return { unchanged: true }

  const meta = {
    timings: page.timings.filter(isTurnTiming),
    hasMore: page.hasMore,
    ...(page.version ? { version: page.version } : {}),
    externalTurn: page.externalTurn,
  }
  return "append" in page ? { append: page.append, ...meta } : { items: page.items, ...meta }
}

export async function transcriptItem(
  sessionId: string,
  id: string,
): Promise<TranscriptItem | undefined> {
  const { item } = await request("GET /api/v1/platform/transcript/item", {
    query: { sessionId, id },
  })
  return item
}

export async function contextUsage(sessionId: string): Promise<ContextUsageEstimate | null> {
  const { usage } = await request("GET /api/v1/platform/context-usage", {
    query: { sessionId },
  })
  return usage
}

export async function contextPreview(
  sessionId: string,
  segmentId: string,
): Promise<ContextUsagePreview | null> {
  const { preview } = await request("GET /api/v1/platform/context-usage", {
    query: { sessionId, preview: segmentId },
  })
  return preview
}

export async function renameSession(id: string, name: string): Promise<void> {
  await request("POST /api/v1/platform/rename-session", { body: { id, name } })
}

export async function deleteSession(id: string): Promise<void> {
  await request("POST /api/v1/platform/delete-session", { body: { id } })
}

export interface StageAttachmentOptions {
  signal?: AbortSignal | undefined
  onProgress?: ((ratio: number) => void) | undefined
}

function uploadRatio(loaded: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(loaded)) return 0
  return Math.min(1, Math.max(0, loaded / total))
}

function stagedBody(text: string): { id: string; code?: string } {
  try {
    const parsed = JSON.parse(text) as { id?: string; code?: string }

    if (typeof parsed.id !== "string") return { id: "" }
    return typeof parsed.code === "string"
      ? { id: parsed.id, code: parsed.code }
      : { id: parsed.id }
  } catch {
    return { id: "" }
  }
}

export function stageAttachment(
  batch: string,
  file: File,
  options: StageAttachmentOptions = {},
): Promise<string> {
  const mimeType = file.type || "application/octet-stream"
  const requestId = crypto.randomUUID()
  const url = routeUrl("POST /api/v1/platform/attachments/stage", {
    query: { batch, name: file.name, mimeType },
  })
  const aborted = () => new DOMException("Aborted", "AbortError")
  return new Promise<string>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(aborted())
      return
    }

    const xhr = new XMLHttpRequest()
    const stopListening = () => options.signal?.removeEventListener("abort", abortRequest)
    const abortRequest = () => xhr.abort()

    xhr.open("POST", url)
    xhr.setRequestHeader("content-type", mimeType)
    xhr.setRequestHeader("x-request-id", requestId)
    options.signal?.addEventListener("abort", abortRequest)

    if (options.onProgress) {
      const report = options.onProgress

      xhr.upload.onprogress = (event) => report(uploadRatio(event.loaded, event.total))
    }

    xhr.onabort = () => {
      stopListening()
      reject(aborted())
    }

    xhr.onerror = () => {
      stopListening()
      reject(new PlatformRequestError(`HTTP_${xhr.status}`, requestId))
    }

    xhr.onload = () => {
      stopListening()
      const body = stagedBody(xhr.responseText)

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new PlatformRequestError(body.code ?? `HTTP_${xhr.status}`, requestId))
        return
      }

      if (!body.id) {
        reject(new PlatformRequestError("INVALID_RESPONSE", requestId))
        return
      }

      resolve(body.id)
    }

    xhr.send(file)
  })
}

export async function discardAttachments(batch: string): Promise<void> {
  await request("POST /api/v1/platform/attachments/discard", { body: { batch } })
}

export async function searchWorkspaceFiles(
  cwd: string,
  query: string,
  signal?: AbortSignal,
): Promise<FileSearchEntry[]> {
  const { entries } = await request("GET /api/v1/platform/files", {
    query: { cwd, q: query },
    ...(signal ? { signal } : {}),
  })
  return entries
}

export async function listWorkspaceCommands(
  cwd: string,
): Promise<{ skills: ComposerCommand[]; prompts: ComposerCommand[] }> {
  return request("GET /api/v1/platform/skills", { query: { cwd } })
}

const fsQuery = (cwd: string, path: string) => ({ cwd, path })

export function fileRawUrl(cwd: string, path: string): string {
  return routeUrl("GET /api/v1/platform/fs/raw", { query: fsQuery(cwd, path) })
}

export function statWorkspaceFile(cwd: string, path: string): Promise<FileStatResponse> {
  return request("GET /api/v1/platform/fs/stat", { query: fsQuery(cwd, path) })
}

export function readWorkspaceFile(
  cwd: string,
  path: string,
  force = false,
): Promise<FileTextResponse> {
  return request("GET /api/v1/platform/fs/text", {
    query: { ...fsQuery(cwd, path), ...(force ? { force: "1" } : {}) },
  })
}

export function listWorkspaceDir(cwd: string, path: string): Promise<DirectoryListResponse> {
  return request("GET /api/v1/platform/fs/list", { query: fsQuery(cwd, path) })
}

export function searchWorkspaceContents(
  cwd: string,
  query: string,
  signal?: AbortSignal,
): Promise<ContentSearchResponse> {
  return request("GET /api/v1/platform/fs/search", {
    query: { cwd, q: query },
    ...(signal ? { signal } : {}),
  })
}

export async function filePreviewToken(cwd: string): Promise<string> {
  const { token } = await request("GET /api/v1/platform/fs/preview-token", { query: { cwd } })
  return token
}
