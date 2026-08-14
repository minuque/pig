import { ref, watch, type Ref } from "vue";
import type { ModelRef, SessionPhase, ThinkingLevel } from "@earendil-works/pi-protocol";
import { errorMessage } from "@client/http.js";
import {
  defaultPresetFrom,
  sameModel,
  thinkingLevelOf,
  type ChatInputPreset,
  type ChatInputVendor,
} from "@features/chat-input/types.js";

interface ChatInputSnapshot {
  model: ModelRef;
  thinkingLevel: ThinkingLevel;
}

interface ChatInputBindingOptions {
  catalog: Ref<ChatInputVendor[]>;
  snapshot: Ref<ChatInputSnapshot | undefined>;
  phase: Ref<SessionPhase | undefined>;
  error: Ref<string>;
  setModel(model: ModelRef): Promise<void>;
  setThinking(level: ThinkingLevel): Promise<void>;
}

/** Session 快照与模型选择器之间唯一的双向同步点。 */
export function useChatInputBinding(options: ChatInputBindingOptions) {
  const preset = ref<ChatInputPreset>();
  const pendingModel = ref(false);

  watch(
    [() => options.snapshot.value?.model, () => options.snapshot.value?.thinkingLevel],
    ([model, level]) => {
      if (model && level && !pendingModel.value) preset.value = { model, thinkingLevel: level };
    },
  );
  watch(
    () => preset.value?.model,
    (model) => {
      const snapshot = options.snapshot.value;
      if (!model || !snapshot || options.phase.value !== "idle" || sameModel(model, snapshot.model))
        return;
      pendingModel.value = true;
      void (async () => {
        try {
          await options.setModel(model);
          const desired = sameModel(preset.value?.model, model)
            ? preset.value?.thinkingLevel
            : undefined;
          if (desired && desired !== options.snapshot.value?.thinkingLevel)
            await options.setThinking(thinkingLevelOf(desired));
        } catch (error) {
          options.error.value = errorMessage(error);
        } finally {
          pendingModel.value = false;
        }
      })();
    },
  );
  watch([() => preset.value?.thinkingLevel, pendingModel], ([level]) => {
    const snapshot = options.snapshot.value;
    if (
      !level ||
      !snapshot ||
      pendingModel.value ||
      options.phase.value !== "idle" ||
      level === snapshot.thinkingLevel
    )
      return;
    void options
      .setThinking(thinkingLevelOf(level))
      .catch((error) => (options.error.value = errorMessage(error)));
  });
  watch(
    options.catalog,
    (items) => {
      if (!preset.value && items.length) preset.value = defaultPresetFrom(items);
    },
    { immediate: true },
  );

  return { preset };
}
