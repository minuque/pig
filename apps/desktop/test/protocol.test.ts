import { describe, expect, it } from "vitest"
import {
  gatewayOriginArg,
  gatewayTargetUrl,
  injectGatewayOrigin,
  isLoopbackHttpOrigin,
  parseGatewayOriginArg,
  pigAppUrl,
} from "../src/main/urls.js"

const GATEWAY = "http://127.0.0.1:8787"

describe("pig protocol URL mapping", () => {
  it("pig://app 路径转到 Gateway HTTP，含 API 与 SPA 路由", () => {
    expect(pigAppUrl()).toBe("pig://app/")
    expect(gatewayTargetUrl("pig://app/", GATEWAY)?.href).toBe(`${GATEWAY}/`)
    expect(gatewayTargetUrl("pig://app/sessions/abc", GATEWAY)?.href).toBe(
      `${GATEWAY}/sessions/abc`,
    )
    expect(gatewayTargetUrl("pig://app/api/v1/platform/session-cards", GATEWAY)?.href).toBe(
      `${GATEWAY}/api/v1/platform/session-cards`,
    )
  })

  it("失败路径：非 app 主机、凭据、坏 URL 一律拒绝", () => {
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
})
