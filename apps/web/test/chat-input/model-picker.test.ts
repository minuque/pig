import { describe, expect, it } from "vitest"
import { catalogFromModels, type ChatInputVendor } from "@features/chat-input/types.js"
import {
  FAVORITES_SCOPE,
  filterCatalog,
  listPickerRows,
  resolveModelInfo,
} from "@features/chat-input/lib/model-preset.js"
import {
  parseFavoriteModels,
  toggleFavoriteKey,
  useModelFavorites,
} from "@features/chat-input/hooks/use-model-favorites.js"

const catalog: ChatInputVendor[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      {
        id: "claude-sonnet",
        name: "Claude Sonnet",
        thinkingLevels: ["low", "high"],
      },
      { id: "claude-haiku", name: "Claude Haiku", thinkingLevels: ["low"] },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [{ id: "gpt-4o", name: "GPT-4o", thinkingLevels: ["none"] }],
  },
]

describe("filterCatalog", () => {
  it("空查询返回完整目录", () => {
    expect(filterCatalog(catalog, "  ")).toEqual(catalog)
  })

  it("按模型名/模型 id/供应商名模糊匹配，并剔除无命中供应商", () => {
    expect(filterCatalog(catalog, "sonnet").map((v) => v.id)).toEqual(["anthropic"])
    expect(filterCatalog(catalog, "gpt-4o").map((v) => v.id)).toEqual(["openai"])
    expect(filterCatalog(catalog, "ANTHROPIC").map((v) => v.id)).toEqual(["anthropic"])
  })

  it("无命中返回空数组", () => {
    expect(filterCatalog(catalog, "不存在的模型")).toEqual([])
  })
})

describe("resolveModelInfo", () => {
  it("命中时返回供应商、模型与可用 thinking level", () => {
    const info = resolveModelInfo(catalog, { provider: "anthropic", id: "claude-sonnet" })
    expect(info.vendor?.id).toBe("anthropic")
    expect(info.model?.id).toBe("claude-sonnet")
    expect(info.levels).toEqual(["low", "high"])
  })

  it("无分隔符/未知供应商/未知模型均回退为空结果", () => {
    expect(resolveModelInfo(catalog, undefined).levels).toEqual([])
    expect(resolveModelInfo(catalog, { provider: "unknown", id: "x" }).levels).toEqual([])
    expect(resolveModelInfo(catalog, { provider: "anthropic", id: "unknown" }).levels).toEqual([])
  })
})

describe("listPickerRows", () => {
  it("按供应商过滤", () => {
    const rows = listPickerRows(catalog, "", "openai", new Set())
    expect(rows.map((row) => row.model.id)).toEqual(["gpt-4o"])
  })

  it("收藏范围只返回已收藏且仍在目录中的模型", () => {
    const rows = listPickerRows(
      catalog,
      "",
      FAVORITES_SCOPE,
      new Set(["anthropic/claude-sonnet", "missing/gone"]),
    )
    expect(rows.map((row) => `${row.vendor.id}/${row.model.id}`)).toEqual([
      "anthropic/claude-sonnet",
    ])
  })

  it("搜索忽略供应商范围，全目录模糊匹配", () => {
    const rows = listPickerRows(catalog, "haiku", "openai", new Set())
    expect(rows.map((row) => row.model.id)).toEqual(["claude-haiku"])
  })
})

describe("catalogFromModels", () => {
  it("用供应商显示名作为分组名", () => {
    const grouped = catalogFromModels([
      {
        provider: "xai",
        id: "grok-4.6",
        name: "Grok 4.6",
        api: "openai-completions",
        reasoning: false,
        input: ["text"],
        contextWindow: 1,
        maxTokens: 1,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        supportedThinkingLevels: ["low"],
        authenticated: true,
      },
    ])
    expect(grouped[0]?.name).toBe("xAI")
  })
})

describe("favorite models", () => {
  it("解析非法 JSON 为空列表", () => {
    expect(parseFavoriteModels("{")).toEqual([])
    expect(parseFavoriteModels('["openai/gpt-4o", 1, "ok"]')).toEqual(["openai/gpt-4o"])
  })

  it("切换收藏并写回 storage", () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value)
      },
    }
    const { isFavorite, toggle } = useModelFavorites(storage)
    expect(isFavorite("openai", "gpt-4o")).toBe(false)
    toggle("openai", "gpt-4o")
    expect(isFavorite("openai", "gpt-4o")).toBe(true)
    expect(toggleFavoriteKey(["openai/gpt-4o"], "openai/gpt-4o")).toEqual([])
    expect(JSON.parse(data.get("pig.favoriteModels") ?? "[]")).toEqual(["openai/gpt-4o"])
  })
})
