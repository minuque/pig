import type { IncomingMessage, ServerResponse } from "node:http"
import { listEnvironments } from "@pig/environment"
import { AttachmentError, type AttachmentErrorCode, sanitizeMimeType } from "../pi/attachments.js"
import { isContextPreviewKey } from "../pi/context-usage.js"
import { validateRemoteDirectory, workspaceEnvironment } from "../pi/remote-session.js"
import { GatewayError, SessionNotFoundError } from "../pi/runtime-types.js"
import type { PiHostService } from "../pi/service.js"
import type { DirectoryPort } from "../system/directory.js"
import { fsRoutes } from "./fs-routes.js"
import {
  HttpError,
  HttpRouter,
  type HttpDeps,
  type HttpRouteTable,
  type MapError,
  defaultMapError,
} from "./router.js"

export type EnvironmentSources = { sshConfigPath?: string; savedPath?: string }

export type PlatformRequestDeps = HttpDeps & {
  hostService: PiHostService
  platformPort: DirectoryPort
  environments: EnvironmentSources
}

function attachmentStatus(code: AttachmentErrorCode): number {
  return code === "PAYLOAD_TOO_LARGE" ? 413 : 400
}

const platformRoutes = {
  "POST /api/v1/platform/select-directory": async (ctx) => {
    const { hostService, platformPort } = ctx.deps
    const payload = await ctx.json().catch((): Record<string, unknown> => ({}))

    if (typeof payload.environment === "string" && payload.environment !== "local") {
      const remote =
        typeof payload.path === "string"
          ? await validateRemoteDirectory(payload.environment, payload.path, ctx.deps.environments)
          : undefined

      if (remote) await hostService.authorizeWorkspace(remote)
      return { path: remote ?? null, requiresManualInput: true }
    }

    const input =
      platformPort.requiresManualInput && typeof payload.path === "string"
        ? payload.path
        : undefined

    if (platformPort.requiresManualInput && !input) return { path: null, requiresManualInput: true }

    const path = input
      ? await platformPort.validateDirectory(input)
      : await platformPort.selectDirectory()

    if (path) await hostService.authorizeWorkspace(path)
    return { path: path ?? null, requiresManualInput: false }
  },

  "POST /api/v1/platform/warm-workspace": async (ctx) => {
    const { hostService } = ctx.deps
    const payload = await ctx.json()
    const path = typeof payload.path === "string" ? payload.path.trim() : ""

    if (!path || !(await hostService.isKnownWorkspace(path))) throw new HttpError(403, "FORBIDDEN")

    hostService.prepareWorkspace(path)
    return { ok: true }
  },

  "GET /api/v1/platform/environments": async ({ deps }) => ({
    environments: await listEnvironments(deps.environments),
  }),

  "GET /api/v1/platform/session-cards": async ({ deps }) => ({
    cards: await deps.hostService.listSessionCards(),
  }),

  "GET /api/v1/platform/context-usage": async ({ url, deps }) => {
    const sessionId = url.searchParams.get("sessionId") ?? ""
    const previewParam = url.searchParams.get("preview")

    if (!sessionId) throw new HttpError(400, "INVALID_REQUEST")

    if (previewParam && !isContextPreviewKey(previewParam))
      throw new HttpError(400, "INVALID_REQUEST")

    const usage = deps.hostService.contextUsage(
      sessionId,
      isContextPreviewKey(previewParam) ? previewParam : undefined,
    )
    return { usage: usage ?? null, preview: usage?.preview ?? null }
  },

  "GET /api/v1/platform/transcript/item": async ({ url, deps }) => {
    const sessionId = url.searchParams.get("sessionId") ?? ""
    const id = url.searchParams.get("id") ?? ""

    if (!sessionId || !id) throw new HttpError(400, "INVALID_REQUEST")
    const item = await deps.hostService.transcriptItem(sessionId, id)

    if (!item) throw new HttpError(404, "NOT_FOUND")
    return { item }
  },

  "GET /api/v1/platform/transcript": async ({ url, deps }) => {
    const sessionId = url.searchParams.get("sessionId") ?? ""

    if (!sessionId) throw new HttpError(400, "INVALID_REQUEST")
    const known = url.searchParams.get("known") ?? undefined
    const after = url.searchParams.get("after") ?? undefined
    return deps.hostService.sessionTranscript(sessionId, { known, after })
  },

  "POST /api/v1/platform/rename-session": async (ctx) => {
    const payload = await ctx.json()
    const id = typeof payload.id === "string" ? payload.id : ""

    if (!id) throw new HttpError(400, "INVALID_REQUEST")
    await ctx.deps.hostService.renameSession(
      id,
      typeof payload.name === "string" ? payload.name : "",
    )
    return { ok: true }
  },

  "POST /api/v1/platform/delete-session": async (ctx) => {
    const payload = await ctx.json()
    const id = typeof payload.id === "string" ? payload.id : ""

    if (!id) throw new HttpError(400, "INVALID_REQUEST")
    await ctx.deps.hostService.deleteSession(id)
    return { ok: true }
  },

  "GET /api/v1/platform/files": async ({ req, url, deps }) => {
    const cwd = url.searchParams.get("cwd")?.trim() ?? ""

    if (!cwd || !(await deps.hostService.isKnownWorkspace(cwd)))
      throw new HttpError(403, "FORBIDDEN")

    const controller = new AbortController()

    req.once("close", () => controller.abort())

    const { env, root } = workspaceEnvironment(cwd)
    const entries = await env.search(root, url.searchParams.get("q") ?? "", {
      signal: controller.signal,
    })
    return { entries }
  },

  "GET /api/v1/platform/skills": async ({ url, deps }) => {
    const cwd = url.searchParams.get("cwd")?.trim() ?? ""

    if (!cwd || !(await deps.hostService.isKnownWorkspace(cwd)))
      throw new HttpError(403, "FORBIDDEN")
    return deps.hostService.workspaceCommands(cwd)
  },

  "POST /api/v1/platform/attachments/stage": async (ctx) => {
    const { attachments } = ctx.deps.hostService
    const params = ctx.url.searchParams

    try {
      const { id } = await attachments.stage({
        batch: params.get("batch") ?? "",
        name: params.get("name") ?? "",
        mimeType: sanitizeMimeType(params.get("mimeType") ?? ""),
        stream: ctx.req,
      })
      return { id }
    } catch (error) {
      if (error instanceof AttachmentError)
        throw new HttpError(attachmentStatus(error.code), error.code)
      throw error
    }
  },

  "POST /api/v1/platform/attachments/discard": async (ctx) => {
    const payload = await ctx.json()
    const batch = typeof payload.batch === "string" ? payload.batch : ""

    if (!batch) throw new HttpError(400, "INVALID_REQUEST")
    await ctx.deps.hostService.attachments.discard(batch)
    return { ok: true }
  },
} satisfies HttpRouteTable<PlatformRequestDeps>
const platformError: MapError = (error, route) => {
  if (error instanceof SessionNotFoundError) return new HttpError(404, "NOT_FOUND")

  if (error instanceof GatewayError) {
    if (error.code === "busy") return new HttpError(409, "BUSY")

    if (error.code === "invalid_request") return new HttpError(400, "INVALID_REQUEST")
  }

  return defaultMapError(error, route)
}
const platformRouter = new HttpRouter<PlatformRequestDeps>(
  { ...platformRoutes, ...fsRoutes },
  platformError,
)

export function handlePlatformRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: PlatformRequestDeps,
): Promise<boolean> {
  return platformRouter.handle(req, res, url, deps)
}
