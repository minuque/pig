import { computed, watch, type Ref } from "vue";
import type { ModelPreset, ModelVendor } from "@pig/contracts";

/** 模型目录过滤：按模型名/模型 id/供应商名模糊匹配；空查询返回完整目录。 */
export function filterCatalog(catalog: ModelVendor[], query: string): ModelVendor[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;
  return catalog
    .map((vendor) => ({
      ...vendor,
      models: vendor.models.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          vendor.name.toLowerCase().includes(q),
      ),
    }))
    .filter((vendor) => vendor.models.length > 0);
}

/** 拆分 "vendorId/modelId"；无分隔符时整体视为 vendorId（模型 id 为空，查不到即回退空结果）。 */
export function parseModelId(modelId: string): { vendorId: string; modelId: string } {
  const sep = modelId.indexOf("/");
  return sep === -1
    ? { vendorId: modelId, modelId: "" }
    : { vendorId: modelId.slice(0, sep), modelId: modelId.slice(sep + 1) };
}

/** 由 "vendorId/modelId" 解析 catalog 中的供应商、模型与可用 thinking level；未知标识返回空结果。 */
export function resolveModelInfo(catalog: ModelVendor[], modelId: string) {
  const { vendorId, modelId: id } = parseModelId(modelId);
  const vendor = catalog.find((v) => v.id === vendorId);
  const model = vendor?.models.find((m) => m.id === id);
  return { vendor, model, levels: model?.thinkingLevels ?? [] };
}

/**
 * 模型选择联动状态：model/level 双向绑定，模型切换后 level 不在可用列表时自动修正。
 * catalog 需传 Ref 或 getter（如 `() => props.catalog`）：值在 computed 内读取，
 * 保证初始为空、之后整体替换时联动仍响应；直接传数组会固化调用时快照。
 */
export function useModelPresetBinding(
  catalog: Ref<ModelVendor[]> | (() => ModelVendor[]),
  preset: Ref<ModelPreset | undefined>,
) {
  const catalogValue = computed(() => (typeof catalog === "function" ? catalog() : catalog.value));
  const model = computed({
    get: () => preset.value?.model ?? "",
    set: (model: string) => {
      preset.value = { model, thinkingLevel: preset.value?.thinkingLevel ?? "" };
    },
  });
  const modelLevels = computed(() => resolveModelInfo(catalogValue.value, model.value).levels);
  const level = computed({
    get: () => preset.value?.thinkingLevel ?? "",
    set: (thinkingLevel: string) => {
      if (preset.value) preset.value = { ...preset.value, thinkingLevel };
    },
  });
  // 联动：模型切换后 level 不可用时自动修正为第一个可用值
  watch(modelLevels, (levels) => {
    if (levels.length && !levels.includes(level.value) && preset.value) {
      preset.value = { ...preset.value, thinkingLevel: levels[0]! };
    }
  });
  return { model, modelLevels, level };
}
