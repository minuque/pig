import { computed, watch, type Ref } from "vue";
import type { ModelRef } from "@earendil-works/pi-protocol";
import type { ChatInputPreset, ChatInputVendor } from "@features/chat-input/types.js";
import { resolveModelInfo } from "@features/chat-input/lib/model-preset.js";

export function useModelPresetBinding(
  catalog: Ref<ChatInputVendor[]> | (() => ChatInputVendor[]),
  preset: Ref<ChatInputPreset | undefined>,
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
  // 切模型后当前 thinkingLevel 不在新模型的档位里时，回落到第一档
  watch(modelLevels, (levels) => {
    if (levels.length && !levels.includes(level.value) && preset.value) {
      preset.value = { ...preset.value, thinkingLevel: levels[0]! };
    }
  });
  return { model, modelLevels, level };
}
