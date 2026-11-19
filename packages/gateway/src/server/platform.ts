/** 平台 HTTP：目录选择、会话卡片、上下文用量、历史、文件与附件；流式端点在 handler 里自己写 res。 */
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

/** 附件错误只区分体积过大，其余按请求问题处理。 */
function attachmentStatus(code: AttachmentErrorCode): number {
  return code === "PAYLOAD_TOO_LARGE" ? 413 : 400
}

const platformRoutes = {
  /** 选目录；给 environment（ssh://主机）时校验远端目录。 */
  "POST /api/v1/platform/select-directory": async (ctx) => {
    const { hostService, platformPort } = ctx.deps
    // 客户端可能不带 body：按空对象继续，交互式平台会回要求手输
    const payload = await ctx.json().catch((): Record<string, unknown> => ({}))

    // 远程目录没有系统对话框，总是手输；存在且是目录才授权
    if (typeof payload.environment === "string" && payload.environment !== "local") {
      const remote =
        typeof payload.path === "string"
          ? await validateRemoteDirectory(payload.environment, payload.path, ctx.deps.environments)
          : undefined

      if (remote) await hostService.authorizeWorkspace(remote)
      return { path: remote ?? null, requiresManualInput: true }
    }

    // 只有需要手输路径的平台才接受客户端传的 path；桌面端必须走系统对话框
    const input =
      platformPort.requiresManualInput && typeof payload.path === "string"
        ? payload.path
        : undefined

    if (platformPort.requiresManualInput && !input) return { path: null, requiresManualInput: true }

    const path = input
      ? await platformPort.validateDirectory(input)
      : await platformPort.selectDirectory()

    // 用户显式选定即授权：后续 /files、/skills、warm 都靠这份清单判定
    if (path) await hostService.authorizeWorkspace(path)
    return { path: path ?? null, requiresManualInput: false }
  },

  /** 客户端告知马上要用的工作目录；只接受已知工作区，预热不授予权限。 */
  "POST /api/v1/platform/warm-workspace": async (ctx) => {
    const { hostService } = ctx.deps
    const payload = await ctx.json()
    const path = typeof payload.path === "string" ? payload.path.trim() : ""

    if (!path || !(await hostService.isKnownWorkspace(path))) throw new HttpError(403, "FORBIDDEN")

    hostService.prepareWorkspace(path)
    return { ok: true }
  },

  /** 可选的环境：本机、pig 保存的环境、~/.ssh/config 里的主机。 */
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

  /** @ 文件引用：cwd 必须是已知工作区（用户选过的目录，或已有会话 cwd），否则拒绝。 */
  "GET /api/v1/platform/files": async ({ req, url, deps }) => {
    const cwd = url.searchParams.get("cwd")?.trim() ?? ""

    if (!cwd || !(await deps.hostService.isKnownWorkspace(cwd)))
      throw new HttpError(403, "FORBIDDEN")

    const controller = new AbortController()

    // 客户端断开/防抖取消时中断遍历，不叠加扫描
    req.once("close", () => controller.abort())

    const { env, root } = workspaceEnvironment(cwd)
    const entries = await env.search(root, url.searchParams.get("q") ?? "", {
      signal: controller.signal,
    })
    return { entries }
  },

  /** / 技能与模板清单：cwd 同上白名单；目录无候选或 loader 未就绪返回空数组。 */
  "GET /api/v1/platform/skills": async ({ url, deps }) => {
    const cwd = url.searchParams.get("cwd")?.trim() ?? ""

    if (!cwd || !(await deps.hostService.isKnownWorkspace(cwd)))
      throw new HttpError(403, "FORBIDDEN")
    return deps.hostService.workspaceCommands(cwd)
  },

  /** 附件字节走原始流直写暂存，绕开 JSON body 的 1MB 上限。 */
  "POST /api/v1/platform/attachments/stage": async (ctx) => {
    const { attachments } = ctx.deps.hostService
    const params = ctx.url.searchParams

    try {
      const { id } = await attachments.stage({
        batch: params.get("batch") ?? "",
        name: params.get("name") ?? "",
        // mimeType 会拼进 prompt 文本行，入口就按 type/subtype 形状净化
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

  /** 撤销一次暂存。前端补偿路径：batch 不存在也回 200，静默成功即可。 */
  "POST /api/v1/platform/attachments/discard": async (ctx) => {
    const payload = await ctx.json()
    const batch = typeof payload.batch === "string" ? payload.batch : ""

    if (!batch) throw new HttpError(400, "INVALID_REQUEST")
    await ctx.deps.hostService.attachments.discard(batch)
    return { ok: true }
  },
} satisfies HttpRouteTable<PlatformRequestDeps>
/** 会话写入的公共失败：找不到 404、忙 409、参数问题 400。 */
const platformError: MapError = (error, route) => {
  if (error instanceof SessionNotFoundError) return new HttpError(404, "NOT_FOUND")

  if (error instanceof GatewayError) {
    if (error.code === "busy") return new HttpError(409, "BUSY")

    if (error.code === "invalid_request") return new HttpError(400, "INVALID_REQUEST")
  }

  return defaultMapError(error, route)
}

/** 平台 HTTP 分发；true=已处理（含 400/404/500）。 */
export async function handlePlatformRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: PlatformRequestDeps,
): Promise<boolean> {
  const table: HttpRouteTable<PlatformRequestDeps> = { ...platformRoutes, ...fsRoutes }
  return new HttpRouter(deps, table, platformError).handle(req, res, url)
}
