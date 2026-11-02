import type { IncomingMessage, ServerResponse } from "node:http"

import {
  ProviderServiceError,
  type LoginEventView,
  type ProviderService,
} from "../pi/provider-service.js"

export type ProviderRequestDeps = {
  send(res: ServerResponse, status: number, body?: unknown): void
  body(req: IncomingMessage): Promise<Record<string, unknown>>
  providers: ProviderService
}

const LOGIN_EVENTS = /^\/api\/v1\/platform\/providers\/login\/([^/]+)\/events$/
const LOGIN_RESPONSES = /^\/api\/v1\/platform\/providers\/login\/([^/]+)\/responses$/
const LOGIN_CANCEL = /^\/api\/v1\/platform\/providers\/login\/([^/]+)\/cancel$/

/** /api/v1/platform 下的供应商路由；true=已处理。 */
export async function handleProviderRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: ProviderRequestDeps,
): Promise<boolean> {
  if (url.pathname === "/api/v1/platform/providers" && req.method === "GET") {
    try {
      deps.send(res, 200, await deps.providers.listProviders())
    } catch (error) {
      fail(error, res, deps, "providers")
    }

    return true
  }

  if (url.pathname === "/api/v1/platform/models" && req.method === "GET") {
    try {
      deps.send(res, 200, await deps.providers.listModels())
    } catch (error) {
      fail(error, res, deps, "models")
    }

    return true
  }

  if (url.pathname === "/api/v1/platform/providers/login" && req.method === "POST") {
    await handleLogin(req, res, deps)
    return true
  }

  const events = LOGIN_EVENTS.exec(url.pathname)

  if (events && req.method === "GET") {
    await handleLoginEvents(req, res, url, decodeURIComponent(events[1] ?? ""), deps)
    return true
  }

  const responses = LOGIN_RESPONSES.exec(url.pathname)

  if (responses && req.method === "POST") {
    await handleLoginResponse(req, res, decodeURIComponent(responses[1] ?? ""), deps)
    return true
  }

  const cancel = LOGIN_CANCEL.exec(url.pathname)

  if (cancel && req.method === "POST") {
    try {
      deps.providers.cancelLogin(decodeURIComponent(cancel[1] ?? ""))
      deps.send(res, 200, { ok: true })
    } catch (error) {
      fail(error, res, deps, "login cancel")
    }

    return true
  }

  if (url.pathname === "/api/v1/platform/providers/logout" && req.method === "POST") {
    await handleLogout(req, res, deps)
    return true
  }

  return false
}

async function handleLogin(req: IncomingMessage, res: ServerResponse, deps: ProviderRequestDeps) {
  const payload = await readBody(req, res, deps)

  if (!payload) return
  const providerId = typeof payload.providerId === "string" ? payload.providerId : ""
  const type = payload.type

  if (!providerId || (type !== "api_key" && type !== "oauth")) {
    deps.send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  try {
    deps.send(res, 200, await deps.providers.login(providerId, type))
  } catch (error) {
    fail(error, res, deps, "login")
  }
}

async function handleLoginEvents(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  loginId: string,
  deps: ProviderRequestDeps,
) {
  if (!deps.providers.hasLogin(loginId)) {
    deps.send(res, 404, { code: "NOT_FOUND" })
    return
  }

  const after = Number(url.searchParams.get("after") ?? 0)
  const controller = new AbortController()

  res.once("close", () => controller.abort())
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  })

  try {
    for await (const event of deps.providers.loginEvents(
      loginId,
      Number.isFinite(after) && after > 0 ? after : 0,
      controller.signal,
    )) {
      res.write(frame(event))
    }
  } catch (error) {
    console.error("login events failed:", error)
  } finally {
    res.end()
  }
}

async function handleLoginResponse(
  req: IncomingMessage,
  res: ServerResponse,
  loginId: string,
  deps: ProviderRequestDeps,
) {
  const payload = await readBody(req, res, deps)

  if (!payload) return
  const value = typeof payload.value === "string" ? payload.value : ""

  try {
    deps.providers.respond(loginId, value)
    deps.send(res, 200, { ok: true })
  } catch (error) {
    fail(error, res, deps, "login response")
  }
}

async function handleLogout(req: IncomingMessage, res: ServerResponse, deps: ProviderRequestDeps) {
  const payload = await readBody(req, res, deps)

  if (!payload) return
  const providerId = typeof payload.providerId === "string" ? payload.providerId : ""

  if (!providerId) {
    deps.send(res, 400, { code: "INVALID_REQUEST" })
    return
  }

  try {
    await deps.providers.logout(providerId)
    deps.send(res, 200, { ok: true })
  } catch (error) {
    fail(error, res, deps, "logout")
  }
}

async function readBody(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ProviderRequestDeps,
): Promise<Record<string, unknown> | undefined> {
  try {
    return await deps.body(req)
  } catch {
    deps.send(res, 400, { code: "INVALID_REQUEST" })
    return undefined
  }
}

function frame(event: LoginEventView): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

function fail(error: unknown, res: ServerResponse, deps: ProviderRequestDeps, label: string) {
  if (error instanceof ProviderServiceError) {
    deps.send(res, error.status, { code: error.code })
    return
  }

  console.error(`${label} failed:`, error)
  deps.send(res, 500, { code: "INTERNAL_ERROR" })
}
