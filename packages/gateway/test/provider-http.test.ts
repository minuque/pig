import { describe, expect, it } from "vitest"
import { getGlobalDispatcher } from "undici"

import { installProviderHttp, providerHttpInstalled } from "../src/server/provider-http.js"

describe("provider HTTP dispatcher", () => {
  it("installs a proxy-aware dispatcher once", () => {
    installProviderHttp()
    installProviderHttp()
    expect(providerHttpInstalled()).toBe(true)
    expect(getGlobalDispatcher().constructor.name).toBe("EnvHttpProxyAgent")
  })
})
