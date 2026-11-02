<template>
  <div class="params">
    <div class="field">
      <span class="field-label">{{ t("settings.models.thinking") }}</span>

      <SegmentedControl
        :model-value="form.thinkingLevel ?? 'off'"
        size="s"
        class="thinking"
        :aria-label="t('settings.models.thinking')"
        @update:model-value="onThinking"
      >
        <SegmentedControlItem v-for="level in THINKING_LEVELS" :key="level" :value="level">
          {{ level }}
        </SegmentedControlItem>
      </SegmentedControl>
    </div>

    <div class="grid">
      <label class="field">
        <span class="field-label">{{ t("settings.models.maxTokens") }}</span>

        <TextFieldRoot
          v-model="form.maxTokens"
          size="s"
          inputmode="numeric"
          class="field-input"
          :data-invalid="invalid.includes('maxTokens') ? '' : undefined"
        />
      </label>

      <label class="field">
        <span class="field-label">{{ t("settings.models.contextWindow") }}</span>

        <TextFieldRoot
          v-model="form.contextWindow"
          size="s"
          inputmode="numeric"
          class="field-input"
          :data-invalid="invalid.includes('contextWindow') ? '' : undefined"
        />
      </label>
    </div>

    <div class="param-head">
      <span class="field-label">{{ t("settings.models.samplingParams") }}</span>

      <button type="button" class="add-param" @click="addParam">
        + {{ t("settings.models.addParam") }}
      </button>
    </div>

    <div v-for="(row, index) in form.samplingParams" :key="index" class="param-line">
      <TextFieldRoot
        v-model="row.key"
        size="s"
        class="field-input"
        :placeholder="t('settings.models.paramKey')"
      />

      <TextFieldRoot
        v-model="row.value"
        size="s"
        class="field-input"
        :placeholder="t('settings.models.paramValue')"
      >
        <TextFieldSlot side="right">
          <button
            type="button"
            class="remove-param"
            :aria-label="t('settings.models.removeParam')"
            @click="removeParam(index)"
          >
            <TrashBinMinimalisticIcon />
          </button>
        </TextFieldSlot>
      </TextFieldRoot>
    </div>

    <p v-if="invalid.length" class="error">{{ t("settings.models.paramInvalid") }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <Button variant="ghost" :disabled="saving" @click="restore">
        {{ t("settings.models.restoreDefaults") }}
      </Button>

      <Button :loading="saving" @click="save">{{ t("settings.models.saveParams") }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue"

import { Button } from "@components/ui/button/index.js"
import { TrashBinMinimalisticIcon } from "@components/icons/index.js"
import { SegmentedControl, SegmentedControlItem } from "@components/ui/segmented-control/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"
import { updateModelParams } from "@client/platform.js"
import { errorMessage } from "@client/http.js"
import { paramsPatchFrom } from "@features/settings/lib/provider-view.js"
import { useI18n } from "@i18n/index.js"
import type {
  ModelParamsFormState,
  ProviderModelView,
  ThinkingLevel,
} from "@/types/provider-type.js"

const props = defineProps<{ providerId: string; model: ProviderModelView }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const saving = ref(false)
const error = ref<string>()
const invalid = ref<Array<"maxTokens" | "contextWindow">>([])
const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"]
const form = reactive<ModelParamsFormState>(toForm(props.model))

function toForm(model: ProviderModelView): ModelParamsFormState {
  return {
    thinkingLevel: model.thinkingLevel ?? null,
    maxTokens: String(model.maxTokens ?? ""),
    contextWindow: String(model.contextWindow ?? ""),
    samplingParams: Object.entries(model.samplingParams ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
    })),
  }
}

watch(
  () => props.model,
  (model) => Object.assign(form, toForm(model)),
)

function onThinking(value: unknown) {
  form.thinkingLevel = value as ThinkingLevel
}

function addParam() {
  form.samplingParams.push({ key: "", value: "" })
}

function removeParam(index: number) {
  form.samplingParams.splice(index, 1)
}

async function save() {
  const result = paramsPatchFrom(form)

  error.value = undefined
  invalid.value = result.ok ? [] : result.fields

  if (!result.ok) return
  saving.value = true

  try {
    await updateModelParams(props.providerId, props.model.id, result.patch)
    emit("saved")
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

async function restore() {
  error.value = undefined
  invalid.value = []
  saving.value = true

  try {
    await updateModelParams(props.providerId, props.model.id, {
      thinkingLevel: null,
      maxTokens: null,
      contextWindow: null,
      samplingParams: null,
    })
    emit("saved")
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.params {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: 2px var(--space-md) var(--space-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.thinking {
  align-self: flex-start;
}

.field-input {
  font-size: var(--text-caption);
}

.field-input[data-invalid] {
  border-color: var(--danger);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.param-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.add-param {
  color: var(--primary);
  font-size: var(--text-eyebrow);
}

.add-param:hover {
  opacity: 0.8;
}

.param-line {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xs);
}

.remove-param {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  color: var(--contrast-foreground-faint);
}

.remove-param:hover {
  color: var(--danger);
}

.remove-param svg {
  inline-size: 13px;
  block-size: 13px;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: var(--text-eyebrow);
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
}

@media (max-width: 560px) {
  .grid,
  .param-line {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
