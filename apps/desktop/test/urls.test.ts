import { describe, expect, it } from "vitest"

import { gatewayTrustUrls } from "../src/main/urls.js"

describe("gatewayTrustUrls", () => {
  it("只覆盖 Gateway 自己的端口，同机其它服务不会收到凭证", () => {
    expect(gatewayTrustUrls(47821)).toEqual(["http://127.0.0.1:47821/*", "ws://127.0.0.1:47821/*"])
  })
})
