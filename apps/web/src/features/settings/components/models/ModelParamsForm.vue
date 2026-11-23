<template>
  <div class="params">
    <div class="field">
      <span class="field-label">{{ t("settings.models.thinking") }}</span>

      <TabsRoot :model-value="form.thinkingLevel ?? 'off'" @update:model-value="onThinking">
        <TabsList variant="segmented" size="s" :aria-label="t('settings.models.thinking')">
          <TabsTrigger v-for="level in THINKING_LEVELS" :key="level" :value="level">
            {{ level }}
          </TabsTrigger>
        </TabsList>
      </TabsRoot>
    </div>

    <div class="grid">
      <label class="field">
        <span class="field-label">{{ t("settings.models.maxTokens") }}</span>

        <TextFieldRoot
          v-model="form.maxTokens"
          size="s"
          inputmode="numeric"
          class="field-input"
          :invalid="invalid.includes('maxTokens')"
          @update:model-value="dirty = true"
        />
      </label>

      <label class="field">
        <span class="field-label">{{ t("settings.models.contextWindow") }}</span>

        <TextFieldRoot
          v-model="form.contextWindow"
          size="s"
          inputmode="numeric"
          class="field-input"
          :invalid="invalid.includes('contextWindow')"
          @update:model-value="dirty = true"
        />
      </label>
    </div>

    <div class="param-head">
      <span class="field-label">{{ t("settings.models.samplingParams") }}</span>

      <Button type="button" size="s" variant="ghost" color="accent" @click="addParam">
        + {{ t("settings.models.addParam") }}
      </Button>
    </div>

    <div v-for="(row, index) in form.samplingParams" :key="index" class="param-line">
      <TextFieldRoot
        v-model="row.key"
        size="s"
        class="field-input"
        :placeholder="t('settings.models.paramKey')"
        @update:model-value="dirty = true"
      />

      <TextFieldRoot
        v-model="row.value"
        size="s"
        class="field-input"
        :placeholder="t('settings.models.paramValue')"
        @update:model-value="dirty = true"
      >
        <TextFieldSlot side="right">
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="danger"
            class="remove-param"
            :aria-label="t('settings.models.removeParam')"
            @click="removeParam(index)"
          >
            <TrashIcon class="size-icon-sm" />
          </IconButton>
        </TextFieldSlot>
      </TextFieldRoot>
    </div>

    <p v-if="invalid.length" class="error">{{ t("settings.models.paramInvalid") }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="actions">
      <Button class="restore-params" size="s" variant="ghost" :disabled="saving" @click="restore">
        {{ t("settings.models.restoreDefaults") }}
      </Button>

      <Button size="s" :loading="saving" @click="save">
        {{ t("settings.models.saveParams") }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue"

import { Button, IconButton } from "@pig/ui/button"
import { TrashIcon } from "@components/icons/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@pig/ui/tabs"
import { TextFieldRoot, TextFieldSlot } from "@pig/ui/text-field"
import { updateModelParams } from "@client/platform.js"
import { errorMessage } from "@client/http.js"
import { paramsPatchFrom } from "@features/settings/lib/provider-view.js"
import { useI18n } from "@i18n/index.js"
import type { ProviderModelView, ThinkingLevel } from "@/types/common-type.js"
import type { ModelParamsFormState } from "@/types/provider-type.js"

const props = defineProps<{ providerId: string; model: ProviderModelView }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const saving = ref(false)
const error = ref<string>()
const invalid = ref<Array<"maxTokens" | "contextWindow">>([])
const dirty = ref(false)
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
  (model) => {
    if (dirty.value) return
    Object.assign(form, toForm(model))
  },
)

function onThinking(value: unknown) {
  form.thinkingLevel = value as ThinkingLevel
  dirty.value = true
}

function addParam() {
  form.samplingParams.push({ key: "", value: "" })
  dirty.value = true
}

function removeParam(index: number) {
  form.samplingParams.splice(index, 1)
  dirty.value = true
}

async function save() {
  const result = paramsPatchFrom(form)

  error.value = undefined
  invalid.value = result.ok ? [] : result.fields

  if (!result.ok) return
  saving.value = true

  try {
    await updateModelParams(props.providerId, props.model.id, result.patch)
    dirty.value = false
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
    dirty.value = false
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
  padding: var(--space-md) var(--card-padding) var(--card-padding);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.field-input {
  font-size: var(--text-meta);
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

.param-line {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-xs);
}

.remove-param {
  inline-size: 20px;
  block-size: 20px;
}

.error {
  margin: 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.restore-params {
  margin: 0;
}

@media (max-width: 560px) {
  .grid,
  .param-line {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
