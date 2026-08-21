import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import {
  catalogFromModels,
  type ChatInputPreset,
  type ChatInputVendor,
} from "@features/chat-input/types.js";
import {
  FAVORITES_SCOPE,
  filterCatalog,
  listPickerRows,
  resolveModelInfo,
} from "@features/chat-input/lib/model-preset.js";
import { vendorDisplayName, vendorIcon } from "@features/chat-input/lib/vendor-logo.js";
import {
  parseFavoriteModels,
  toggleFavoriteKey,
  useModelFavorites,
} from "@features/chat-input/hooks/use-model-favorites.js";
import { useModelPresetBinding } from "@features/chat-input/hooks/use-model-preset-binding.js";

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
];

describe("filterCatalog", () => {
  it("空查询返回完整目录", () => {
    expect(filterCatalog(catalog, "  ")).toEqual(catalog);
  });

  it("按模型名/模型 id/供应商名模糊匹配，并剔除无命中供应商", () => {
    expect(filterCatalog(catalog, "sonnet").map((v) => v.id)).toEqual(["anthropic"]);
    expect(filterCatalog(catalog, "gpt-4o").map((v) => v.id)).toEqual(["openai"]);
    expect(filterCatalog(catalog, "ANTHROPIC").map((v) => v.id)).toEqual(["anthropic"]);
  });

  it("无命中返回空数组", () => {
    expect(filterCatalog(catalog, "不存在的模型")).toEqual([]);
  });
});

describe("resolveModelInfo", () => {
  it("命中时返回供应商、模型与可用 thinking level", () => {
    const info = resolveModelInfo(catalog, { provider: "anthropic", id: "claude-sonnet" });
    expect(info.vendor?.id).toBe("anthropic");
    expect(info.model?.id).toBe("claude-sonnet");
    expect(info.levels).toEqual(["low", "high"]);
  });

  it("无分隔符/未知供应商/未知模型均回退为空结果", () => {
    expect(resolveModelInfo(catalog, undefined).levels).toEqual([]);
    expect(resolveModelInfo(catalog, { provider: "unknown", id: "x" }).levels).toEqual([]);
    expect(resolveModelInfo(catalog, { provider: "anthropic", id: "unknown" }).levels).toEqual([]);
  });
});

describe("useModelPresetBinding", () => {
  it("模型切换后 level 不可用时由状态所有者自动修正", async () => {
    const preset = ref<ChatInputPreset | undefined>({
      model: { provider: "anthropic", id: "claude-sonnet" },
      thinkingLevel: "high",
    });
    const { model, level } = useModelPresetBinding(() => catalog, preset);

    model.value = { provider: "openai", id: "gpt-4o" };
    await nextTick();

    expect(preset.value).toEqual({
      model: { provider: "openai", id: "gpt-4o" },
      thinkingLevel: "none",
    });
    expect(level.value).toBe("none");
  });

  it("支持 Ref 形式 catalog", () => {
    const catalogRef = ref<ChatInputVendor[]>(catalog);
    const preset = ref<ChatInputPreset | undefined>({
      model: { provider: "anthropic", id: "claude-sonnet" },
      thinkingLevel: "high",
    });
    const { modelLevels } = useModelPresetBinding(catalogRef, preset);

    expect(modelLevels.value).toEqual(["low", "high"]);
  });

  it("初始空 catalog 整体替换后联动仍响应（getter 契约回归）", async () => {
    // getter 内读取响应式源（对应 `() => props.catalog`），整体替换后联动重算
    const current = ref<ChatInputVendor[]>([]);
    const preset = ref<ChatInputPreset | undefined>({
      model: { provider: "anthropic", id: "claude-sonnet" },
      thinkingLevel: "high",
    });
    const { model, modelLevels, level } = useModelPresetBinding(() => current.value, preset);

    expect(modelLevels.value).toEqual([]);

    current.value = catalog; // 整体替换
    await nextTick();
    expect(modelLevels.value).toEqual(["low", "high"]);
    expect(level.value).toBe("high");

    model.value = { provider: "openai", id: "gpt-4o" };
    await nextTick();
    expect(preset.value).toEqual({
      model: { provider: "openai", id: "gpt-4o" },
      thinkingLevel: "none",
    });
  });
});

describe("listPickerRows", () => {
  it("按供应商过滤", () => {
    const rows = listPickerRows(catalog, "", "openai", new Set());
    expect(rows.map((row) => row.model.id)).toEqual(["gpt-4o"]);
  });

  it("收藏范围只返回已收藏且仍在目录中的模型", () => {
    const rows = listPickerRows(
      catalog,
      "",
      FAVORITES_SCOPE,
      new Set(["anthropic/claude-sonnet", "missing/gone"]),
    );
    expect(rows.map((row) => `${row.vendor.id}/${row.model.id}`)).toEqual([
      "anthropic/claude-sonnet",
    ]);
  });

  it("搜索在当前范围内模糊匹配", () => {
    const rows = listPickerRows(catalog, "haiku", "anthropic", new Set());
    expect(rows.map((row) => row.model.id)).toEqual(["claude-haiku"]);
  });
});

describe("vendorDisplayName / vendorIcon", () => {
  it("已知供应商给出显示名和 LobeHub 图标", () => {
    expect(vendorDisplayName("openai")).toBe("OpenAI");
    expect(vendorDisplayName("azure-openai-responses")).toBe("Azure");
    expect(vendorDisplayName("openai-codex")).toBe("OpenAI");
    expect(vendorDisplayName("qwen-token-plan-cn")).toBe("Qwen");
    expect(vendorIcon("xai")?.src).toBeTruthy();
    expect(vendorIcon("xai")?.tinted).toBe(true);
    expect(vendorIcon("deepseek")?.tinted).toBe(false);
  });

  it("未知供应商保留原 id 且无图标", () => {
    expect(vendorDisplayName("acme-labs")).toBe("acme-labs");
    expect(vendorIcon("acme-labs")).toBeUndefined();
  });
});

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
    ]);
    expect(grouped[0]?.name).toBe("xAI");
  });
});

describe("favorite models", () => {
  it("解析非法 JSON 为空列表", () => {
    expect(parseFavoriteModels("{")).toEqual([]);
    expect(parseFavoriteModels('["openai/gpt-4o", 1, "ok"]')).toEqual(["openai/gpt-4o"]);
  });

  it("切换收藏并写回 storage", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const { isFavorite, toggle } = useModelFavorites(storage);
    expect(isFavorite("openai", "gpt-4o")).toBe(false);
    toggle("openai", "gpt-4o");
    expect(isFavorite("openai", "gpt-4o")).toBe(true);
    expect(toggleFavoriteKey(["openai/gpt-4o"], "openai/gpt-4o")).toEqual([]);
    expect(JSON.parse(data.get("pig.favoriteModels") ?? "[]")).toEqual(["openai/gpt-4o"]);
  });
});
