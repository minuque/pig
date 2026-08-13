import { computed, watch, type Ref } from "vue";
import type { ModelRef } from "@earendil-works/pi-protocol";
import { sameModel, type ComposerPreset, type ComposerVendor } from "@components/composer/types.js";

export function filterCatalog(catalog: ComposerVendor[], query: string): ComposerVendor[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog;
  return catalog
    .map((vendor) => ({
      ...vendor,
      models: vendor.models.filter(
        (model) =>
          model.name.toLowerCase().includes(q) ||
          model.id.toLowerCase().includes(q) ||
          vendor.name.toLowerCase().includes(q),
      ),
    }))
    .filter((vendor) => vendor.models.length > 0);
}

export function resolveModelInfo(catalog: ComposerVendor[], ref: ModelRef | undefined) {
  const vendor = catalog.find((item) => item.id === ref?.provider);
  const model = vendor?.models.find((item) => item.id === ref?.id);
  return { vendor, model, levels: model?.thinkingLevels ?? [] };
}

export function useModelPresetBinding(
  catalog: Ref<ComposerVendor[]> | (() => ComposerVendor[]),
  preset: Ref<ComposerPreset | undefined>,
) {
  const catalogValue = computed(() => (typeof catalog === "function" ? catalog() : catalog.value));
  const model = computed({
    get: () => preset.value?.model,
    set: (model: ModelRef | undefined) => {
      if (model) preset.value = { model, thinkingLevel: preset.value?.thinkingLevel ?? "" };
    },
  });
  const modelLevels = computed(() => resolveModelInfo(catalogValue.value, model.value).levels);
  const level = computed({
    get: () => preset.value?.thinkingLevel ?? "",
    set: (thinkingLevel: string) => {
      if (preset.value) preset.value = { ...preset.value, thinkingLevel };
    },
  });
  watch(modelLevels, (levels) => {
    if (levels.length && !levels.includes(level.value) && preset.value) {
      preset.value = { ...preset.value, thinkingLevel: levels[0]! };
    }
  });
  return { model, modelLevels, level, sameModel };
}
