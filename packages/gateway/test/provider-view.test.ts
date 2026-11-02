import { describe, expect, it } from "vitest"

import { projectProvider, isModelEnabled, toggleEnabledModel } from "../src/pi/provider-view.js"

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

    expect(configured.status).toEqual({ configured: true, source: "environment", hint: null })
    expect(unconfigured.status).toEqual({ configured: false, source: null, hint: null })
  })

  it("带上密钥末四位提示", () => {
    const view = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: true, source: "stored" },
      [],
      {},
      "builtin",
      "4f2a",
    )

    expect(view.status).toEqual({ configured: true, source: "stored", hint: "4f2a" })
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
    expect(view.api).toBe("anthropic-messages")
    expect(view.models).toEqual([
      {
        id: "claude-opus",
        name: "claude-opus",
        input: ["text"],
        reasoning: true,
        contextWindow: 200_000,
        maxTokens: 32_000,
        samplingParams: { temperature: 1 },
        thinkingLevel: "high",
        enabled: true,
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

  it("模型开放状态来自 enabledModels", () => {
    const view = projectProvider(
      provider({ apiKey: { login: async () => undefined } }),
      { configured: true, source: "stored" },
      [model("claude-opus") as never, model("claude-sonnet") as never],
      {},
      "builtin",
      null,
      ["anthropic/claude-opus"],
    )

    expect(view.models.map((item) => item.enabled)).toEqual([true, false])
  })
})

describe("enabledModels", () => {
  const models = [
    { provider: "anthropic", id: "opus" },
    { provider: "anthropic", id: "sonnet" },
  ]

  it("支持 provider/model、裸 id 与 thinking 后缀", () => {
    expect(isModelEnabled(undefined, "anthropic", "opus")).toBe(true)
    expect(isModelEnabled(["anthropic/opus"], "anthropic", "opus")).toBe(true)
    expect(isModelEnabled(["opus"], "anthropic", "opus")).toBe(true)
    expect(isModelEnabled(["anthropic/opus:high"], "anthropic", "opus")).toBe(true)
    expect(isModelEnabled(["anthropic/sonnet"], "anthropic", "opus")).toBe(false)
  })

  it("关闭一个模型写入其余模型，重新打开全部后清空", () => {
    expect(toggleEnabledModel(undefined, models, "anthropic", "opus", false)).toEqual([
      "anthropic/sonnet",
    ])
    expect(
      toggleEnabledModel(["anthropic/sonnet"], models, "anthropic", "opus", true),
    ).toBeUndefined()
    expect(toggleEnabledModel(undefined, models, "anthropic", "opus", true)).toBeUndefined()
  })

  it("空列表表示全部关闭，未配置才表示全部开放", () => {
    expect(isModelEnabled(undefined, "anthropic", "opus")).toBe(true)
    expect(isModelEnabled([], "anthropic", "opus")).toBe(false)
  })

  it("关闭最后一个模型得到空列表，再从空列表只打开一个", () => {
    expect(toggleEnabledModel(["anthropic/opus"], models, "anthropic", "opus", false)).toEqual([])
    expect(toggleEnabledModel([], models, "anthropic", "sonnet", true)).toEqual([
      "anthropic/sonnet",
    ])
  })
})
