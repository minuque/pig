import assert from "node:assert/strict"
import { resolve } from "node:path"
import { before, describe, it } from "node:test"

import { scanApi } from "./api.mjs"

const root = resolve(import.meta.dirname, "../..")

describe("scanApi", () => {
  let api

  before(() => {
    api = scanApi(root)
  })

  it("字面量路由带方法、处理文件与 web 调用方", () => {
    const route = api.http.find((r) => r.path === "/api/v1/platform/rename-session")
    assert.equal(route?.method, "POST")
    assert.equal(route.handler, "packages/gateway/src/server/platform.ts")
    assert.ok(route.callers.includes("apps/web/src/client/platform.ts"))
  })

  it("正则路由的捕获组显示成参数", () => {
    assert.ok(api.http.some((r) => r.path === "/api/v1/platform/providers/:1/key"))
    assert.ok(api.http.some((r) => r.path === "/api/v1/platform/providers/:1/models/:2/params"))
  })

  it("WS 命令与事件来自协议联合类型", () => {
    assert.ok(api.ws.commands.includes("prompt"))
    assert.ok(api.ws.events.includes("session_progress"))
  })
})
