/**
 * 具名 platform HTTP API。路径字符串只出现在本文件。
 */
import { PlatformRequestError, platformRequest } from "@client/http.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"
import type { ModelMetadata } from "@/types/common-type.js"
import type {
  CustomProviderInput,
  LoginEvent,
  ModelParamsPatch,
  ProviderListResponse,
  ProviderTestResult,
} from "@/types/provider-type.js"
import type { SessionCard } from "@/types/session-type.js"
import type { TurnTiming } from "@/types/turn-type.js"

export async function selectDirectory(
  path?: string,
): Promise<{ path: string | null; requiresManualInput: boolean }> {
  const result = await platformRequest<{
    path: string | null
    requiresManualInput?: boolean
  }>(
    "/api/v1/platform/select-directory",
    path === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify({ path }) },
  )
  return {
    path: result.path,
    requiresManualInput: Boolean(result.requiresManualInput),
  }
}

/** 通知 Host 这个目录马上要用来建会话；Host 在后台预热同一份扩展与技能。 */
export async function warmWorkspace(path: string): Promise<void> {
  await platformRequest("/api/v1/platform/warm-workspace", {
    method: "POST",
    body: JSON.stringify({ path }),
  })
}

export async function listSessionCards(): Promise<SessionCard[]> {
  const result = await platformRequest<{ cards: SessionCard[] }>("/api/v1/platform/session-cards")
  return result.cards
}

/** 设置 · 模型：供应商视图与默认模型。 */
export async function listProviders(): Promise<ProviderListResponse> {
  return platformRequest<ProviderListResponse>("/api/v1/platform/providers")
}

/** 刷新后的模型目录；与 PiServer 快照里的 models 同形。 */
export async function listProviderModels(): Promise<ModelMetadata[]> {
  const result = await platformRequest<{ models: ModelMetadata[] }>("/api/v1/platform/models")
  return result.models
}

/** 开始一次供应商登录；事件由 openLoginEvents 消费。 */
export async function loginProvider(input: {
  providerId: string
  type: "api_key" | "oauth"
}): Promise<{ loginId: string }> {
  return platformRequest<{ loginId: string }>("/api/v1/platform/providers/login", {
    method: "POST",
    body: JSON.stringify(input),
  })
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
    `/api/v1/platform/providers/login/${encodeURIComponent(loginId)}/events?after=${after}`,
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
  await platformRequest(
    `/api/v1/platform/providers/login/${encodeURIComponent(loginId)}/responses`,
    {
      method: "POST",
      body: JSON.stringify({ value }),
    },
  )
}

export async function cancelLogin(loginId: string): Promise<void> {
  await platformRequest(`/api/v1/platform/providers/login/${encodeURIComponent(loginId)}/cancel`, {
    method: "POST",
  })
}

export async function logoutProvider(providerId: string): Promise<void> {
  await platformRequest("/api/v1/platform/providers/logout", {
    method: "POST",
    body: JSON.stringify({ providerId }),
  })
}

/** 复制操作：明文只在这次响应里出现，调用方直接写剪贴板。 */
export async function copyProviderKey(providerId: string): Promise<string> {
  const result = await platformRequest<{ key: string }>(
    `/api/v1/platform/providers/${encodeURIComponent(providerId)}/key`,
  )
  return result.key
}

/** 最小请求验证凭据；失败时返回上游原文。 */
export async function testProvider(
  providerId: string,
  modelId?: string,
): Promise<ProviderTestResult> {
  return platformRequest<ProviderTestResult>("/api/v1/platform/providers/test", {
    method: "POST",
    body: JSON.stringify({ providerId, ...(modelId ? { modelId } : {}) }),
  })
}

/** 新增或更新自定义供应商；空 apiKey 保留旧值。 */
export async function saveCustomProvider(input: CustomProviderInput): Promise<void> {
  await platformRequest(`/api/v1/platform/providers/custom/${encodeURIComponent(input.id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export async function deleteCustomProvider(providerId: string): Promise<void> {
  await platformRequest(`/api/v1/platform/providers/custom/${encodeURIComponent(providerId)}`, {
    method: "DELETE",
  })
}

/** 让 gateway 全量刷新 runtime，返回刷新后的供应商列表。 */
export async function refreshProviderCatalog(): Promise<ProviderListResponse> {
  return platformRequest<ProviderListResponse>("/api/v1/platform/providers/refresh", {
    method: "POST",
  })
}

/** 调整单个模型的思考强度、输出上限与采样参数；null 删除该项。 */
export async function updateModelParams(
  providerId: string,
  modelId: string,
  patch: ModelParamsPatch,
): Promise<void> {
  await platformRequest(
    `/api/v1/platform/providers/${encodeURIComponent(providerId)}/models/${encodeURIComponent(modelId)}/params`,
    { method: "PUT", body: JSON.stringify(patch) },
  )
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

export async function sessionTranscript(
  sessionId: string,
  before?: string,
): Promise<{ items: TranscriptItem[]; timings: TurnTiming[]; hasMore: boolean }> {
  const query = new URLSearchParams({ sessionId })

  if (before) query.set("before", before)

  const result = await platformRequest<{
    items: TranscriptItem[]
    timings?: unknown[]
    hasMore?: boolean
  }>(`/api/v1/platform/transcript?${query.toString()}`)
  return {
    items: Array.isArray(result.items) ? result.items : [],
    timings: Array.isArray(result.timings) ? result.timings.filter(isTurnTiming) : [],
    hasMore: Boolean(result.hasMore),
  }
}

export async function contextUsage(sessionId: string): Promise<ContextUsageEstimate | null> {
  const result = await platformRequest<{ usage: ContextUsageEstimate | null }>(
    `/api/v1/platform/context-usage?sessionId=${encodeURIComponent(sessionId)}`,
  )
  return result.usage
}

export async function contextPreview(
  sessionId: string,
  segmentId: string,
): Promise<{ title: string; content: string } | null> {
  const result = await platformRequest<{
    preview: { title: string; content: string } | null
  }>(
    `/api/v1/platform/context-usage?sessionId=${encodeURIComponent(sessionId)}&preview=${encodeURIComponent(segmentId)}`,
  )
  return result.preview
}

export async function renameSession(id: string, name: string): Promise<void> {
  await platformRequest("/api/v1/platform/rename-session", {
    method: "POST",
    body: JSON.stringify({ id, name }),
  })
}

export async function deleteSession(id: string): Promise<void> {
  await platformRequest("/api/v1/platform/delete-session", {
    method: "POST",
    body: JSON.stringify({ id }),
  })
}

/** 暂存一个附件：字节走原始 body，batch 由输入卡生成。 */
export async function stageAttachment(batch: string, file: File): Promise<string> {
  const mimeType = file.type || "application/octet-stream"
  const query = new URLSearchParams({ batch, name: file.name, mimeType })
  const result = await platformRequest<{ id: string }>(
    `/api/v1/platform/attachments/stage?${query.toString()}`,
    { method: "POST", body: file, headers: { "content-type": mimeType } },
  )
  return result.id
}

/** 把 batch 绑到 Session：该 Session 下一次 prompt 消费这批附件。 */
export async function bindAttachments(sessionId: string, batch: string): Promise<void> {
  await platformRequest("/api/v1/platform/attachments/bind", {
    method: "POST",
    body: JSON.stringify({ sessionId, batch }),
  })
}

/** 丢弃一个批次：幂等，成功路径不要调用，Gateway 已经消费掉它。 */
export async function discardAttachments(batch: string): Promise<void> {
  await platformRequest("/api/v1/platform/attachments/discard", {
    method: "POST",
    body: JSON.stringify({ batch }),
  })
}

/** @ 文件引用候选：cwd 相对路径，目录带尾斜杠。 */
export interface FileSearchEntry {
  path: string
  kind: "file" | "directory"
}

export async function searchWorkspaceFiles(
  cwd: string,
  query: string,
  signal?: AbortSignal,
): Promise<FileSearchEntry[]> {
  const params = new URLSearchParams({ cwd, q: query })
  const result = await platformRequest<{ entries: FileSearchEntry[] }>(
    `/api/v1/platform/files?${params.toString()}`,
    signal ? { signal } : undefined,
  )
  return result.entries
}

/** / 菜单候选：Pi 资源加载器发现的技能与 prompt 模板。 */
export interface ComposerCommand {
  name: string
  description: string
  /** 模板用法提示，如 "<issue-number>"。 */
  argumentHint?: string
}

export async function listWorkspaceCommands(
  cwd: string,
): Promise<{ skills: ComposerCommand[]; prompts: ComposerCommand[] }> {
  const result = await platformRequest<{
    skills: ComposerCommand[]
    prompts: ComposerCommand[]
  }>(`/api/v1/platform/skills?cwd=${encodeURIComponent(cwd)}`)
  return { skills: result.skills, prompts: result.prompts }
}
