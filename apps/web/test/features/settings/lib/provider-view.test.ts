import { describe, expect, it } from "vitest"

import type { ProviderView } from "@/types/provider-type.js"
import {
  customProviderPayload,
  groupProviders,
  providerSourceText,
  providerStatusBadge,
} from "@features/settings/lib/provider-view.js"

const provider = (overrides: Partial<ProviderView>): ProviderView => ({
  id: "anthropic",
  name: "Anthropic",
  kind: "builtin",
  capabilities: { apiKey: true, oauth: false, ambient: false },
  status: { configured: false, source: null, hint: null },
  models: [],
  ...overrides,
})

describe("groupProviders", () => {
  it("按已连接、内置、自定义排序，空组不出现", () => {
    const groups = groupProviders(
      [
        provider({ id: "ollama", name: "Ollama", kind: "custom" }),
        provider({ id: "openai", name: "OpenAI" }),
        provider({
          id: "anthropic",
          name: "Anthropic",
          status: { configured: true, source: "stored", hint: null },
        }),
      ],
      "",
    )

    expect(groups.map((group) => group.id)).toEqual(["connected", "builtin", "custom"])
    expect(groups.map((group) => group.providers.map((item) => item.id))).toEqual([
      ["anthropic"],
      ["openai"],
      ["ollama"],
    ])
  })

  it("已连接的自定义供应商留在已连接组", () => {
    const groups = groupProviders(
      [
        provider({
          id: "ollama",
          kind: "custom",
          status: { configured: true, source: "models_json_key", hint: null },
        }),
      ],
      "",
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.id).toBe("connected")
  })

  it("搜索匹配名称或 id，忽略大小写与首尾空白", () => {
    const providers = [
      provider({ id: "anthropic", name: "Anthropic" }),
      provider({ id: "deepseek", name: "DeepSeek" }),
    ]

    expect(
      groupProviders(providers, "  DEEP ").flatMap((group) =>
        group.providers.map((item) => item.id),
      ),
    ).toEqual(["deepseek"])
    expect(
      groupProviders(providers, "anthropic").flatMap((group) =>
        group.providers.map((item) => item.id),
      ),
    ).toEqual(["anthropic"])
    expect(groupProviders(providers, "missing")).toEqual([])
  })
})

describe("providerSourceText", () => {
  it("把 runtime 来源归成应用内、环境变量、models.json 与未连接", () => {
    expect(providerSourceText({ configured: true, source: "stored" })).toBe("app")
    expect(providerSourceText({ configured: true, source: "runtime" })).toBe("app")
    expect(providerSourceText({ configured: true, source: "environment" })).toBe("environment")
    expect(providerSourceText({ configured: true, source: "models_json_key" })).toBe("modelsJson")
    expect(providerSourceText({ configured: true, source: "models_json_command" })).toBe(
      "modelsJson",
    )
    expect(providerSourceText({ configured: false, source: null })).toBe("none")
    expect(providerSourceText({ configured: false, source: "fallback" })).toBe("none")
  })
})

describe("providerStatusBadge", () => {
  it("只给已连接、未连接、等待授权三种状态", () => {
    expect(
      providerStatusBadge(
        provider({ status: { configured: true, source: "stored", hint: null } }),
        false,
      ),
    ).toBe("connected")
    expect(providerStatusBadge(provider({}), false)).toBe("disconnected")
    expect(providerStatusBadge(provider({}), true)).toBe("authorizing")
    expect(
      providerStatusBadge(
        provider({ status: { configured: true, source: "stored", hint: null } }),
        true,
      ),
    ).toBe("authorizing")
  })
})

describe("customProviderPayload", () => {
  const draft = (overrides: Record<string, unknown> = {}) => ({
    id: "ollama",
    name: "",
    baseUrl: "http://localhost:11434/v1",
    api: "openai-completions",
    apiKey: "",
    models: [
      {
        id: "llama3",
        name: "",
        contextWindow: "128000",
        maxTokens: "8192",
        reasoning: true,
        image: false,
      },
    ],
    ...overrides,
  })

  it("缺 ID 或 Base URL 时给出字段", () => {
    expect(customProviderPayload(draft({ id: "  " }))).toEqual({ ok: false, field: "id" })
    expect(customProviderPayload(draft({ baseUrl: "" }))).toEqual({
      ok: false,
      field: "baseUrl",
    })
  })

  it("空 apiKey 不发送，显示名回退到 ID", () => {
    const result = customProviderPayload(draft())

    expect(result).toEqual({
      ok: true,
      payload: {
        id: "ollama",
        name: "ollama",
        baseUrl: "http://localhost:11434/v1",
        api: "openai-completions",
        models: [
          {
            id: "llama3",
            input: ["text"],
            contextWindow: 128000,
            maxTokens: 8192,
            reasoning: true,
          },
        ],
      },
    })
  })

  it("模型按 ID 去重，空 ID 丢弃，图片输入追加 image", () => {
    const result = customProviderPayload(
      draft({
        apiKey: "key",
        models: [
          { id: "a", name: "A", contextWindow: "", maxTokens: "", reasoning: false, image: true },
          {
            id: "a",
            name: "重复",
            contextWindow: "",
            maxTokens: "",
            reasoning: false,
            image: false,
          },
          { id: " ", name: "空", contextWindow: "", maxTokens: "", reasoning: false, image: false },
        ],
      }),
    )

    expect(result.ok).toBe(true)

    if (!result.ok) return
    expect(result.payload.apiKey).toBe("key")
    expect(result.payload.models).toEqual([{ id: "a", name: "A", input: ["text", "image"] }])
  })
})
