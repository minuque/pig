/** /api/v1/platform 下的供应商路由：目录、登录事件流、密钥、模型参数与自定义供应商。 */
import type { IncomingMessage, ServerResponse } from "node:http"
import type { CustomModelInput, LoginEvent, ModelParamsPatch } from "@pig/protocol"
import { ProviderServiceError, type ProviderService } from "../pi/provider-service.js"
import {
  HttpError,
  HttpRouter,
  type HttpDeps,
  type HttpRouteTable,
  type MapError,
  defaultMapError,
} from "./router.js"

export type ProviderRequestDeps = HttpDeps & { providers: ProviderService }

function frame(event: LoginEvent): string {
  return `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

const providerRoutes = {
  "GET /api/v1/platform/providers": async ({ deps }) => deps.providers.listProviders(),

  /** 让 gateway 全量刷新 runtime，返回刷新后的目录。 */
  "POST /api/v1/platform/providers/refresh": async ({ deps }) => deps.providers.refreshAll(),

  "GET /api/v1/platform/models": async ({ deps }) => deps.providers.listModels(),

  /** 开始一次供应商登录；事件由 events 那一路消费。 */
  "POST /api/v1/platform/providers/login": async (ctx) => {
    const payload = await ctx.json()
    const providerId = typeof payload.providerId === "string" ? payload.providerId : ""
    const type = payload.type

    if (!providerId || (type !== "api_key" && type !== "oauth"))
      throw new HttpError(400, "INVALID_REQUEST")
    return ctx.deps.providers.login(providerId, type)
  },

  /** 最小请求验证凭据；失败时返回上游原文。 */
  "POST /api/v1/platform/providers/test": async (ctx) => {
    const payload = await ctx.json()
    const providerId = typeof payload.providerId === "string" ? payload.providerId : ""

    if (!providerId) throw new HttpError(400, "INVALID_REQUEST")
    const modelId = typeof payload.modelId === "string" ? payload.modelId : undefined
    return ctx.deps.providers.testConnection(providerId, modelId)
  },

  /** 登录事件流：帧按 seq 续传，done/error 之后服务端断开。 */
  "GET /api/v1/platform/providers/login/:loginId/events": async ({ res, url, params, deps }) => {
    const { loginId } = params

    if (!deps.providers.hasLogin(loginId)) throw new HttpError(404, "NOT_FOUND")

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
  },

  "POST /api/v1/platform/providers/login/:loginId/responses": async (ctx) => {
    const payload = await ctx.json()

    ctx.deps.providers.respond(
      ctx.params.loginId,
      typeof payload.value === "string" ? payload.value : "",
    )
    return { ok: true }
  },

  "POST /api/v1/platform/providers/login/:loginId/cancel": async ({ params, deps }) => {
    deps.providers.cancelLogin(params.loginId)
    return { ok: true }
  },

  "POST /api/v1/platform/providers/logout": async (ctx) => {
    const payload = await ctx.json()
    const providerId = typeof payload.providerId === "string" ? payload.providerId : ""

    if (!providerId) throw new HttpError(400, "INVALID_REQUEST")
    await ctx.deps.providers.logout(providerId)
    return { ok: true }
  },

  /** 复制操作：明文只在这次响应里出现，调用方直接写剪贴板。 */
  "GET /api/v1/platform/providers/:providerId/key": async ({ params, deps }) =>
    deps.providers.copyKey(params.providerId),

  /** 新增或更新自定义供应商；空 apiKey 保留旧值。 */
  "PUT /api/v1/platform/providers/custom/:providerId": async (ctx) => {
    const payload = await ctx.json()
    const { providerId } = ctx.params
    const name = typeof payload.name === "string" ? payload.name.trim() : ""
    const api = typeof payload.api === "string" ? payload.api : ""
    const models = Array.isArray(payload.models) ? payload.models : undefined

    if (!providerId || !name || !api || !models) throw new HttpError(400, "INVALID_REQUEST")

    await ctx.deps.providers.saveCustom({
      id: providerId,
      name,
      api,
      ...(typeof payload.baseUrl === "string" && payload.baseUrl
        ? { baseUrl: payload.baseUrl }
        : {}),
      ...(typeof payload.apiKey === "string" ? { apiKey: payload.apiKey } : {}),
      models: models.filter(
        (model): model is CustomModelInput =>
          Boolean(model) &&
          typeof model === "object" &&
          typeof (model as { id?: unknown }).id === "string",
      ),
    })
    return { ok: true }
  },

  "DELETE /api/v1/platform/providers/custom/:providerId": async ({ params, deps }) => {
    await deps.providers.deleteCustom(params.providerId)
    return { ok: true }
  },

  /** 调整单个模型的思考强度、输出上限与采样参数；null 删除该项。 */
  "PUT /api/v1/platform/providers/:providerId/models/:modelId/params": async (ctx) => {
    const payload = await ctx.json()
    const { providerId, modelId } = ctx.params

    await ctx.deps.providers.updateModelParams(providerId, modelId, payload as ModelParamsPatch)
    return { ok: true }
  },

  /** 开放或关闭一个模型；关闭后不进 Composer 目录。 */
  "PUT /api/v1/platform/providers/:providerId/models/:modelId/enabled": async (ctx) => {
    const payload = await ctx.json()
    const { providerId, modelId } = ctx.params

    if (typeof payload.enabled !== "boolean") throw new HttpError(400, "INVALID_REQUEST")
    await ctx.deps.providers.setModelEnabled(providerId, modelId, payload.enabled)
    return { ok: true }
  },
} satisfies HttpRouteTable<ProviderRequestDeps>
/** 供应商服务的失败自带状态码与错误码。 */
const providerError: MapError = (error, route) => {
  if (error instanceof ProviderServiceError) return new HttpError(error.status, error.code)
  return defaultMapError(error, route)
}

/** 供应商 HTTP 分发；true=已处理（含 400/404/409/500）。 */
export async function handleProviderRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: ProviderRequestDeps,
): Promise<boolean> {
  return new HttpRouter(deps, providerRoutes, providerError).handle(req, res, url)
}
