import { computed, watch, type Ref } from "vue";
import type { ModelPreset, ModelVendor } from "@no-pi-no-gang/contracts";

/** 由 "vendorId/modelId" 解析 catalog 中的供应商、模型与可用 thinking level。 */
export function resolveModelInfo(catalog: ModelVendor[], modelId: string) {
  const sep = modelId.indexOf("/");
  const vendor = catalog.find((v) => v.id === modelId.slice(0, sep));
  const model = vendor?.models.find((m) => m.id === modelId.slice(sep + 1));
  return { vendor, model, levels: model?.thinkingLevels ?? [] };
}

/**
 * 模型选择联动状态：model/level 双向绑定，模型切换后 level 不在可用列表时自动修正。
 * catalog 传 props 数组即可（computed 内部访问 props 会建立响应式依赖）。
 */
export function useModelPresetBinding(
  catalog: ModelVendor[],
  preset: Ref<ModelPreset | undefined>,
) {
  const model = computed({
    get: () => preset.value?.model ?? "",
    set: (model: string) => {
      preset.value = { model, thinkingLevel: preset.value?.thinkingLevel ?? "" };
    },
  });
  const modelLevels = computed(() => resolveModelInfo(catalog, model.value).levels);
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
