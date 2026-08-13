import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { ComposerPreset, ComposerVendor } from "@components/composer/types.js";
import {
  filterCatalog,
  resolveModelInfo,
  useModelPresetBinding,
} from "@components/composer/model-preset.js";

const catalog: ComposerVendor[] = [
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
    const preset = ref<ComposerPreset | undefined>({
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
    const catalogRef = ref<ComposerVendor[]>(catalog);
    const preset = ref<ComposerPreset | undefined>({
      model: { provider: "anthropic", id: "claude-sonnet" },
      thinkingLevel: "high",
    });
    const { modelLevels } = useModelPresetBinding(catalogRef, preset);

    expect(modelLevels.value).toEqual(["low", "high"]);
  });

  it("初始空 catalog 整体替换后联动仍响应（getter 契约回归）", async () => {
    // getter 内读取响应式源（对应 `() => props.catalog`），整体替换后联动重算
    const current = ref<ComposerVendor[]>([]);
    const preset = ref<ComposerPreset | undefined>({
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
