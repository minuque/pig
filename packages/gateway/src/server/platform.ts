import type { IncomingMessage, ServerResponse } from "node:http"
import { PiServerError, SessionNotFoundError } from "@earendil-works/pi-server"
import type { DirectoryPort } from "../directory.js"
import { AttachmentError, sanitizeMimeType, type AttachmentErrorCode } from "../pi/attachments.js"
import { isContextPreviewKey } from "../pi/context-usage.js"
import { searchFiles, MAX_FILE_SEARCH_RESULTS } from "../pi/file-search.js"
import type { PiHostService } from "../pi/service.js"

export type PlatformRequestDeps = {
  send(res: ServerResponse, status: number, body?: unknown): void
  body(req: IncomingMessage): Promise<Record<string, unknown>>
  hostService: PiHostService
  platformPort: DirectoryPort
}

/** 平台 HTTP：目录选择与预热、会话卡片、上下文用量、重命名与删除。true=已处理（含 400/404/500）。 */
export async function handlePlatformRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: PlatformRequestDeps,
): Promise<boolean> {
  if (url.pathname === "/api/v1/platform/select-directory" && req.method === "POST") {
    await handleSelectDirectory(req, res, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/warm-workspace" && req.method === "POST") {
    await handleWarmWorkspace(req, res, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/session-cards" && req.method === "GET") {
    await handleSessionCards(res, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/context-usage" && req.method === "GET") {
    await handleContextUsage(res, url, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/transcript" && req.method === "GET") {
    await handleTranscript(res, url, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/rename-session" && req.method === "POST") {
    await handleRenameSession(req, res, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/delete-session" && req.method === "POST") {
    await handleDeleteSession(req, res, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/files" && req.method === "GET") {
    await handleFiles(req, res, url, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/skills" && req.method === "GET") {
    await handleSkills(res, url, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/attachments/stage" && req.method === "POST") {
    await handleStageAttachment(req, res, url, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/attachments/bind" && req.method === "POST") {
    await handleBindAttachments(req, res, deps)
    return true
  }

  if (url.pathname === "/api/v1/platform/attachments/discard" && req.method === "POST") {
    await handleDiscardAttachment(req, res, deps)
    return true
  }

  return false
}

/** 附件字节走原始流直写暂存，绕开 JSON body 的 1MB 上限。 */
async function handleStageAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps

  try {
    const { id } = await hostService.attachments.stage({
      batch: url.searchParams.get("batch") ?? "",
      name: url.searchParams.get("name") ?? "",
      // mimeType 会拼进 prompt 文本行，入口就按 type/subtype 形状净化
      mimeType: sanitizeMimeType(url.searchParams.get("mimeType") ?? ""),
      stream: req,
    })

    send(res, 200, { id })
  } catch (error) {
    if (error instanceof AttachmentError) {
      send(res, attachmentStatus(error.code), { code: error.code })
      return
    }

    console.error("attachments/stage failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

async function handleBindAttachments(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps
  const payload = await readObjectBody(req, res, deps)

  if (!payload) return

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
  const batch = typeof payload.batch === "string" ? payload.batch : ""

  if (!sessionId || !batch) {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  if (!(await hostService.hasSession(sessionId))) {
    send(res, 404, { code: "NOT_FOUND" })
    return
  }

  try {
    hostService.attachments.bind(sessionId, batch)
    send(res, 200, { ok: true })
  } catch (error) {
    if (error instanceof AttachmentError) {
      send(res, 400, { code: error.code })
      return
    }

    console.error("attachments/bind failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

function attachmentStatus(code: AttachmentErrorCode): number {
  return code === "PAYLOAD_TOO_LARGE" ? 413 : 400
}

/** 撤销一次暂存。前端补偿路径：batch 不存在也回 200，静默成功即可。 */
async function handleDiscardAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps
  const payload = await readObjectBody(req, res, deps)

  if (!payload) return

  const batch = typeof payload.batch === "string" ? payload.batch : ""

  if (!batch) {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  try {
    await hostService.attachments.discard(batch)
    send(res, 200, { ok: true })
  } catch (error) {
    console.error("attachments/discard failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

async function handleSelectDirectory(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, body, platformPort, hostService } = deps

  try {
    const payload = await body(req).catch((): Record<string, unknown> => ({}))
    const input = typeof payload.path === "string" ? payload.path : undefined

    if (platformPort.requiresManualInput && !input) {
      send(res, 200, { path: null, requiresManualInput: true })
      return
    }

    const path = input
      ? await platformPort.validateDirectory(input)
      : await platformPort.selectDirectory()

    // 用户显式选定即授权：后续 /files、/skills、warm 都靠这份清单判定
    if (path) await hostService.authorizeWorkspace(path)
    send(res, 200, { path: path ?? null, requiresManualInput: false })
  } catch (error) {
    console.error("select-directory failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

/** 客户端告知马上要用的工作目录；只接受已知工作区，预热不授予权限。 */
async function handleWarmWorkspace(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps
  const payload = await readObjectBody(req, res, deps)

  if (!payload) return
  const path = typeof payload.path === "string" ? payload.path.trim() : ""

  if (!path || !(await hostService.isKnownWorkspace(path))) {
    send(res, 403, { code: "FORBIDDEN" })
    return
  }

  hostService.prepareWorkspace(path)
  send(res, 200, { ok: true })
}

async function handleSessionCards(res: ServerResponse, deps: PlatformRequestDeps) {
  const { send, hostService } = deps

  try {
    const cards = await hostService.listSessionCards()
    send(res, 200, { cards })
  } catch (error) {
    console.error("session-cards failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

/** @ 文件引用：cwd 必须是已知工作区（用户选过的目录，或已有会话 cwd），否则拒绝。 */
async function handleFiles(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps
  const cwd = url.searchParams.get("cwd")?.trim() ?? ""

  if (!cwd || !(await hostService.isKnownWorkspace(cwd))) {
    send(res, 403, { code: "FORBIDDEN" })
    return
  }

  const query = url.searchParams.get("q") ?? ""
  const controller = new AbortController()

  // 客户端断开/防抖取消时中断遍历，不叠加扫描
  req.once("close", () => controller.abort())

  try {
    const entries = await searchFiles(cwd, query, MAX_FILE_SEARCH_RESULTS, controller.signal)
    send(res, 200, { entries })
  } catch (error) {
    console.error("files failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

/** / 技能清单：cwd 同上白名单；目录无技能或 loader 未就绪返回空数组。 */
async function handleSkills(res: ServerResponse, url: URL, deps: PlatformRequestDeps) {
  const { send, hostService } = deps
  const cwd = url.searchParams.get("cwd")?.trim() ?? ""

  if (!cwd || !(await hostService.isKnownWorkspace(cwd))) {
    send(res, 403, { code: "FORBIDDEN" })
    return
  }

  try {
    const skills = await hostService.workspaceSkills(cwd)
    send(res, 200, { skills })
  } catch (error) {
    console.error("skills failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

async function handleTranscript(res: ServerResponse, url: URL, deps: PlatformRequestDeps) {
  const { send, hostService } = deps
  const sessionId = url.searchParams.get("sessionId") ?? ""

  if (!sessionId) {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  const before = url.searchParams.get("before") ?? undefined

  try {
    send(res, 200, await hostService.sessionTranscript(sessionId, before ? { before } : undefined))
  } catch (error) {
    sendSessionWriteError(error, res, send, "transcript")
  }
}

async function handleContextUsage(res: ServerResponse, url: URL, deps: PlatformRequestDeps) {
  const { send, hostService } = deps

  try {
    const sessionId = url.searchParams.get("sessionId") ?? ""

    if (!sessionId) {
      send(res, 400, { code: "INVALID_REQUEST" })
      return
    }

    const previewParam = url.searchParams.get("preview")

    if (previewParam && !isContextPreviewKey(previewParam)) {
      send(res, 400, { code: "INVALID_REQUEST" })
      return
    }

    const usage = hostService.contextUsage(
      sessionId,
      isContextPreviewKey(previewParam) ? previewParam : undefined,
    )

    send(res, 200, { usage: usage ?? null, preview: usage?.preview ?? null })
  } catch (error) {
    console.error("context-usage failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
}

async function readObjectBody(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
): Promise<Record<string, unknown> | undefined> {
  try {
    return await deps.body(req)
  } catch {
    deps.send(res, 400, { code: "INVALID_REQUEST" })
    return undefined
  }
}

function sendSessionWriteError(
  error: unknown,
  res: ServerResponse,
  send: PlatformRequestDeps["send"],
  label: string,
) {
  if (error instanceof SessionNotFoundError) {
    send(res, 404, { code: "NOT_FOUND" })
    return
  }

  if (error instanceof PiServerError && error.code === "busy") {
    send(res, 409, { code: "BUSY" })
    return
  }

  if (error instanceof PiServerError && error.code === "invalid_request") {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  console.error(`${label} failed:`, error)
  send(res, 500, { code: "INTERNAL_ERROR" })
}

async function handleRenameSession(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps
  const payload = await readObjectBody(req, res, deps)

  if (!payload) return

  const id = typeof payload.id === "string" ? payload.id : ""

  if (!id) {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  try {
    const name = typeof payload.name === "string" ? payload.name : ""
    await hostService.renameSession(id, name)
    send(res, 200, { ok: true })
  } catch (error) {
    sendSessionWriteError(error, res, send, "rename-session")
  }
}

async function handleDeleteSession(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, hostService } = deps
  const payload = await readObjectBody(req, res, deps)

  if (!payload) return

  const id = typeof payload.id === "string" ? payload.id : ""

  if (!id) {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  try {
    await hostService.deleteSession(id)
    send(res, 200, { ok: true })
  } catch (error) {
    sendSessionWriteError(error, res, send, "delete-session")
  }
}
