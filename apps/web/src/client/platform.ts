/**
 * 具名 platform HTTP API：路径模板、方法与返回形状都来自 @pig/protocol 的契约表。
 */
import { PlatformRequestError, platformRequest } from "@client/http.js"
import type {
  ComposerCommand,
  ContentSearchResponse,
  ContextUsageEstimate,
  ContextUsagePreview,
  CustomProviderInput,
  DirectoryListResponse,
  EnvironmentInfo,
  FileSearchEntry,
  FileStatResponse,
  FileTextResponse,
  GitStatusResponse,
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
  SessionTranscriptPage,
  TranscriptItem,
  TurnTiming,
} from "@/types/common-type.js"

/** 带参数或请求体的端点必须给出 options，其余可以省略。 */
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

/** 路径模板里的 :name 用 params 填，query 只带已定义的值。 */
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

/** 选目录；给 environment（ssh://主机）时校验远端目录。 */
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

/** 可选环境：本机、pig 保存的环境、~/.ssh/config 里的主机。 */
export async function listEnvironments(): Promise<EnvironmentInfo[]> {
  const { environments } = await request("GET /api/v1/platform/environments")
  return environments
}

/** 通知 Host 这个目录马上要用来建会话；Host 在后台预热同一份扩展与技能。 */
export async function warmWorkspace(path: string): Promise<void> {
  await request("POST /api/v1/platform/warm-workspace", { body: { path } })
}

export async function listSessionCards(): Promise<SessionCard[]> {
  const { cards } = await request("GET /api/v1/platform/session-cards")
  return cards
}

/** 设置 · 模型：供应商视图与默认模型。 */
export async function listProviders(): Promise<ProviderListResponse> {
  return request("GET /api/v1/platform/providers")
}

/** 刷新后的模型目录；与 PiServer 快照里的 models 同形。 */
export async function listProviderModels(): Promise<ModelMetadata[]> {
  const { models } = await request("GET /api/v1/platform/models")
  return models
}

/** 开始一次供应商登录；事件由 openLoginEvents 消费。 */
export async function loginProvider(input: {
  providerId: string
  type: "api_key" | "oauth"
}): Promise<{ loginId: string }> {
  return request("POST /api/v1/platform/providers/login", { body: input })
}

/** 消费登录事件流；done/error 后服务端关闭连接。 */
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

/** 复制操作：明文只在这次响应里出现，调用方直接写剪贴板。 */
export async function copyProviderKey(providerId: string): Promise<string> {
  const { key } = await request("GET /api/v1/platform/providers/:providerId/key", {
    params: { providerId },
  })
  return key
}

/** 最小请求验证凭据；失败时返回上游原文。 */
export async function testProvider(
  providerId: string,
  modelId?: string,
): Promise<ProviderTestResult> {
  return request("POST /api/v1/platform/providers/test", {
    body: { providerId, ...(modelId ? { modelId } : {}) },
  })
}

/** 新增或更新自定义供应商；空 apiKey 保留旧值。 */
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

/** 让 gateway 全量刷新 runtime，返回刷新后的供应商列表。 */
export async function refreshProviderCatalog(): Promise<ProviderListResponse> {
  return request("POST /api/v1/platform/providers/refresh")
}

/** 调整单个模型的思考强度、输出上限与采样参数；null 删除该项。 */
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

/** 开放或关闭一个模型；关闭后不进 Composer 目录。 */
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

/** 会话全部历史的轻量形态：大块工具输出被截断，展开时用 transcriptItem 取回。known 未变得到 unchanged；after 对得上得到 append。 */
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

/** 单条完整条目；找不到时返回 undefined。 */
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

/** 暂存一个附件：字节走原始 body，batch 由输入卡生成。 */
export async function stageAttachment(batch: string, file: File): Promise<string> {
  const mimeType = file.type || "application/octet-stream"
  const { id } = await platformRequest<{ id: string }>(
    routeUrl("POST /api/v1/platform/attachments/stage", {
      query: { batch, name: file.name, mimeType },
    }),
    { method: "POST", body: file, headers: { "content-type": mimeType } },
  )
  return id
}

/** 丢弃一个批次：幂等，成功路径不要调用，Gateway 已经消费掉它。 */
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

/** 工作区内文件的原始字节地址；图片、音视频、PDF 直接用它加载。 */
export function fileRawUrl(cwd: string, path: string): string {
  return routeUrl("GET /api/v1/platform/fs/raw", { query: fsQuery(cwd, path) })
}

export function statWorkspaceFile(cwd: string, path: string): Promise<FileStatResponse> {
  return request("GET /api/v1/platform/fs/stat", { query: fsQuery(cwd, path) })
}

/** force：二进制也按文本读出。 */
export function readWorkspaceFile(
  cwd: string,
  path: string,
  force = false,
): Promise<FileTextResponse> {
  return request("GET /api/v1/platform/fs/text", {
    query: { ...fsQuery(cwd, path), ...(force ? { force: "1" } : {}) },
  })
}

/** 列一个目录；path 用 "." 表示工作区根。 */
export function listWorkspaceDir(cwd: string, path: string): Promise<DirectoryListResponse> {
  return request("GET /api/v1/platform/fs/list", { query: fsQuery(cwd, path) })
}

export function workspaceGitStatus(cwd: string): Promise<GitStatusResponse> {
  return request("GET /api/v1/platform/git/status", { query: { cwd } })
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

/** HTML 预览用的令牌：沙箱页面没有 cookie，凭它取工作区里的同目录资源。 */
export async function filePreviewToken(cwd: string): Promise<string> {
  const { token } = await request("GET /api/v1/platform/fs/preview-token", { query: { cwd } })
  return token
}
