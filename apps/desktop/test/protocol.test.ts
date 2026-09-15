import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  gatewayOriginArg,
  gatewayTargetUrl,
  injectGatewayOrigin,
  isLoopbackHttpOrigin,
  isPigApiPath,
  parseGatewayOriginArg,
  pigAppUrl,
  pigCorsHeaders,
  pigSpaFallback,
  resolvePigWebFile,
  viteDevOrigin,
  viteDevPort,
} from "../src/main/urls.js"

const GATEWAY = "http://127.0.0.1:8787"

const WEB_ROOT = join("G:", "web")

describe("Vite 开发端口", () => {
  it("默认 5173，--port 优先于 PIG_VITE_PORT", () => {
    expect(viteDevPort([], {})).toBe(5173)
    expect(viteDevOrigin([], {})).toBe("http://127.0.0.1:5173")
    expect(viteDevPort(["--port", "5175"], { PIG_VITE_PORT: "5180" })).toBe(5175)
    expect(viteDevPort(["--port=5176"], {})).toBe(5176)
    expect(viteDevPort([], { PIG_VITE_PORT: "5177" })).toBe(5177)
  })

  it("无效 --port 抛错", () => {
    expect(() => viteDevPort(["--port", "0"], {})).toThrow("无效 --port")
    expect(() => viteDevPort(["--port=abc"], {})).toThrow("无效 --port")
  })
})

describe("pig protocol URL mapping", () => {
  it("API 走 Gateway，静态资源落到 webRoot，SPA 回退 index.html", () => {
    expect(pigAppUrl()).toBe("pig://app/")
    expect(isPigApiPath("/api/v1/platform/session-cards")).toBe(true)
    expect(gatewayTargetUrl("pig://app/api/v1/platform/session-cards", GATEWAY)?.href).toBe(
      `${GATEWAY}/api/v1/platform/session-cards`,
    )
    expect(
      resolvePigWebFile(WEB_ROOT, "/assets/app.js")?.endsWith(join("web", "assets", "app.js")),
    ).toBe(true)
    expect(pigSpaFallback(WEB_ROOT, "/sessions/abc")?.endsWith(join("web", "index.html"))).toBe(
      true,
    )
    expect(pigSpaFallback(WEB_ROOT, "/assets/app.js")).toBeUndefined()
  })

  it("失败路径：非 app 主机、凭据、坏 URL 一律拒绝", () => {
    expect(isPigApiPath("/assets/app.js")).toBe(false)
    expect(resolvePigWebFile(WEB_ROOT, "/../secret")).toBeUndefined()
    expect(gatewayTargetUrl("pig://other/", GATEWAY)).toBeUndefined()
    expect(gatewayTargetUrl("http://127.0.0.1:8787/", GATEWAY)).toBeUndefined()
    expect(gatewayTargetUrl("pig://user:pass@app/", GATEWAY)).toBeUndefined()
    expect(gatewayTargetUrl("not a url", GATEWAY)).toBeUndefined()
  })
})

describe("Gateway origin 注入", () => {
  it("合法回环地址写入 argv 与 html head", () => {
    expect(isLoopbackHttpOrigin(GATEWAY)).toBe(true)
    expect(parseGatewayOriginArg(["--dev", gatewayOriginArg(GATEWAY)])).toBe(GATEWAY)
    expect(injectGatewayOrigin("<head><title>pig</title></head>", GATEWAY)).toContain(
      `dataset.pigGatewayOrigin=${JSON.stringify(GATEWAY)}`,
    )
  })

  it("失败路径：非回环或带路径的地址丢弃", () => {
    expect(isLoopbackHttpOrigin("http://example.com")).toBe(false)
    expect(isLoopbackHttpOrigin("http://127.0.0.1:8787/foo")).toBe(false)
    expect(parseGatewayOriginArg([gatewayOriginArg("http://8.8.8.8")])).toBeUndefined()
    expect(parseGatewayOriginArg([])).toBeUndefined()
  })

  it("pig:// 响应带模块脚本所需 CORS 头", () => {
    const headers = pigCorsHeaders(new Headers({ "content-type": "text/javascript" }))
    expect(headers.get("Access-Control-Allow-Origin")).toBe("pig://app")
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin")
  })
})
