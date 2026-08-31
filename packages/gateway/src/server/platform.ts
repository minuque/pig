import type { IncomingMessage, ServerResponse } from "node:http"
import { PiServerError, SessionNotFoundError } from "@earendil-works/pi-server"
import type { DirectoryPort } from "../directory.js"
import { isContextPreviewKey } from "../pi/context-usage.js"
import type { PiHostService } from "../pi/service.js"

export type PlatformRequestDeps = {
  send(res: ServerResponse, status: number, body?: unknown): void
  body(req: IncomingMessage): Promise<Record<string, unknown>>
  hostService: PiHostService
  platformPort: DirectoryPort
}

/** 平台 HTTP：目录选择、会话卡片、上下文用量、重命名与删除。true=已处理（含 400/404/500）。 */
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
  return false
}

async function handleSelectDirectory(
  req: IncomingMessage,
  res: ServerResponse,
  deps: PlatformRequestDeps,
) {
  const { send, body, platformPort } = deps
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
    send(res, 200, { path: path ?? null, requiresManualInput: false })
  } catch (error) {
    console.error("select-directory failed:", error)
    send(res, 500, { code: "INTERNAL_ERROR" })
  }
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

async function handleTranscript(res: ServerResponse, url: URL, deps: PlatformRequestDeps) {
  const { send, hostService } = deps
  const sessionId = url.searchParams.get("sessionId") ?? ""
  if (!sessionId) {
    send(res, 400, { code: "INVALID_REQUEST" })
    return
  }
  try {
    send(res, 200, await hostService.sessionTranscript(sessionId))
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
