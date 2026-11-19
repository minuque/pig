import type { IncomingMessage, ServerResponse } from "node:http"
import { describe, expect, it, vi } from "vitest"

import { HttpError, HttpRouter, type HttpDeps, type HttpRouteTable } from "../src/server/router.js"

const table = {
  "DELETE /api/v1/platform/providers/custom/:providerId": async ({ params }) => {
    if (!params.providerId) throw new HttpError(400, "INVALID_REQUEST")
    return { ok: true }
  },
  "GET /api/v1/platform/providers/:providerId/key": async ({ params }) => ({
    key: params.providerId,
  }),
  "POST /api/v1/platform/rename-session": async (ctx) => {
    const payload = await ctx.json()

    if (payload.name === "boom") throw new HttpError(409, "BUSY")
    return { ok: true }
  },
} satisfies HttpRouteTable<HttpDeps>
const request = (method: string) => ({ method }) as IncomingMessage
const response = () => ({ headersSent: false, destroy: vi.fn() }) as unknown as ServerResponse
const url = (path: string) => new URL(`http://127.0.0.1${path}`)

function setup(body: () => Promise<Record<string, unknown>> = async () => ({})) {
  const sent: { status: number; body: unknown }[] = []
  const deps: HttpDeps = {
    send: (_res, status, payload) => sent.push({ status, body: payload }),
    body,
  }
  return { deps, sent }
}

describe("HttpRouter", () => {
  const router = new HttpRouter(table)

  it("命中后自动发 200 与 handler 的返回值", async () => {
    const { deps, sent } = setup()
    const handled = await router.handle(
      request("GET"),
      response(),
      url("/api/v1/platform/providers/anthropic/key"),
      deps,
    )

    expect(handled).toBe(true)
    expect(sent).toEqual([{ status: 200, body: { key: "anthropic" } }])
  })

  it(":param 取出并解码", async () => {
    const { deps, sent } = setup()

    await router.handle(
      request("GET"),
      response(),
      url(`/api/v1/platform/providers/${encodeURIComponent("a/b")}/key`),
      deps,
    )
    await router.handle(
      request("GET"),
      response(),
      url("/api/v1/platform/providers/custom/x"),
      deps,
    )
    await router.handle(
      request("DELETE"),
      response(),
      url("/api/v1/platform/providers/custom/x"),
      deps,
    )

    expect(sent).toEqual([
      { status: 200, body: { key: "a/b" } },
      { status: 200, body: { ok: true } },
    ])
  })

  it("坏 URL 编码命中后回 400，未命中别的路由仍返回未处理", async () => {
    const { deps, sent } = setup()

    expect(
      await router.handle(
        request("GET"),
        response(),
        url("/api/v1/platform/providers/%E0%A4%A/other"),
        deps,
      ),
    ).toBe(false)
    expect(
      await router.handle(
        request("GET"),
        response(),
        url("/api/v1/platform/providers/%E0%A4%A/key"),
        deps,
      ),
    ).toBe(true)
    expect(sent).toEqual([{ status: 400, body: { code: "INVALID_REQUEST" } }])
  })

  it("方法与路径对不上都返回未处理，不写响应", async () => {
    const { deps, sent } = setup()

    expect(
      await router.handle(
        request("POST"),
        response(),
        url("/api/v1/platform/providers/x/key"),
        deps,
      ),
    ).toBe(false)
    expect(
      await router.handle(request("GET"), response(), url("/api/v1/platform/nope"), deps),
    ).toBe(false)
    expect(
      await router.handle(request("GET"), response(), url("/api/v1/platform/providers/x"), deps),
    ).toBe(false)
    expect(sent).toEqual([])
  })

  it("body 读不出来回 400 INVALID_REQUEST", async () => {
    const { deps, sent } = setup(async () => {
      throw new Error("bad json")
    })

    await router.handle(request("POST"), response(), url("/api/v1/platform/rename-session"), deps)

    expect(sent).toEqual([{ status: 400, body: { code: "INVALID_REQUEST" } }])
  })

  it("HttpError 原样发出", async () => {
    const { deps, sent } = setup(async () => ({ name: "boom" }))

    await router.handle(request("POST"), response(), url("/api/v1/platform/rename-session"), deps)

    expect(sent).toEqual([{ status: 409, body: { code: "BUSY" } }])
  })

  it("其他异常交给 mapError，默认记日志并回 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const { deps, sent } = setup()
    const failing = new HttpRouter({
      "GET /api/v1/platform/session-cards": async () => Promise.reject(new Error("nope")),
    })

    await failing.handle(request("GET"), response(), url("/api/v1/platform/session-cards"), deps)

    expect(sent).toEqual([{ status: 500, body: { code: "INTERNAL_ERROR" } }])
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })
})
