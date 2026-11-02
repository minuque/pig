import { describe, expect, it } from "vitest"

import { projectProvider } from "../src/pi/provider-view.js"

type Auth = Record<string, unknown>

const provider = (auth: Auth, id = "anthropic") =>
  ({
    id,
    name: id,
    baseUrl: "https://api.example.com",
    auth,
  }) as never
const model = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  reasoning: true,
  contextWindow: 200_000,
  maxTokens: 32_000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  input: ["text"],
  api: "anthropic-messages",
  provider: "anthropic",
  ...extra,
})

describe("projectProvider", () => {
  it("映射连接来源；没有 source 时给 null", () => {
    const configured = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: true, source: "environment" },
      [],
      {},
      "builtin",
    )
    const unconfigured = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: false },
      [],
      {},
      "builtin",
    )

    expect(configured.status).toEqual({ configured: true, source: "environment" })
    expect(unconfigured.status).toEqual({ configured: false, source: null })
  })

  it("区分可填 Key、可订阅登录与只能走环境变量", () => {
    const apiKeyOnly = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: false },
      [],
      {},
      "builtin",
    )
    const oauthOnly = projectProvider(
      provider({ oauth: { login: async () => undefined } }),
      { configured: false },
      [],
      {},
      "builtin",
    )
    const ambientOnly = projectProvider(
      provider({ apiKey: { resolve: async () => undefined } }),
      { configured: false },
      [],
      {},
      "builtin",
    )
    const both = projectProvider(
      provider({
        apiKey: { login: async () => undefined },
        oauth: { login: async () => undefined },
      }),
      { configured: false },
      [],
      {},
      "builtin",
    )

    expect(apiKeyOnly.capabilities).toEqual({ apiKey: true, oauth: false, ambient: false })
    expect(oauthOnly.capabilities).toEqual({ apiKey: false, oauth: true, ambient: false })
    expect(ambientOnly.capabilities).toEqual({ apiKey: false, oauth: false, ambient: true })
    expect(both.capabilities).toEqual({ apiKey: true, oauth: true, ambient: false })
  })

  it("模型带 thinking 默认值与参数，空模型列表照样保留供应商", () => {
    const view = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: true, source: "stored" },
      [
        model("claude-opus", {
          samplingParams: { temperature: 1 },
        }) as never,
      ],
      { "anthropic/claude-opus": "high" },
      "custom",
    )

    expect(view.kind).toBe("custom")
    expect(view.models).toEqual([
      {
        id: "claude-opus",
        name: "claude-opus",
        reasoning: true,
        contextWindow: 200_000,
        maxTokens: 32_000,
        samplingParams: { temperature: 1 },
        thinkingLevel: "high",
      },
    ])

    const empty = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: false },
      [],
      {},
      "builtin",
    )

    expect(empty.models).toEqual([])
  })
})
