import { describe, expect, it } from "vitest"

import { oauthAction } from "@features/settings/lib/mcp-draft.js"

const http = (config: Record<string, unknown> = {}) => ({
  transport: "http" as const,
  config: { url: "https://x/mcp", ...config },
})

describe("OAuth 按钮", () => {
  it("只有需要授权的 HTTP server 显示登录", () => {
    expect(oauthAction(http(), { status: "needs-auth", tools: [] })).toBe("login")
    expect(oauthAction(http(), { status: "failed", tools: [] })).toBeUndefined()
    expect(oauthAction(http(), undefined)).toBeUndefined()
  })

  it("用请求头或供应商鉴权的 server 不走 OAuth", () => {
    const probe = { status: "needs-auth" as const, tools: [] }

    expect(oauthAction(http({ headers: { authorization: "Bearer x" } }), probe)).toBeUndefined()
    expect(oauthAction(http({ auth: { provider: "radius" } }), probe)).toBeUndefined()
    expect(oauthAction({ transport: "stdio", config: { command: "npx" } }, probe)).toBeUndefined()
  })

  it("连通的 OAuth server 显示退出", () => {
    expect(oauthAction(http(), { status: "connected", tools: [] })).toBe("logout")
  })
})
