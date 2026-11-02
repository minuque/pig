<template>
  <section class="custom-form">
    <button type="button" class="provider-back" @click="emit('cancel')">
      <ArrowLeftIcon class="back-icon" />
      {{ t("settings.models.providers") }}
    </button>

    <header class="detail-head">
      <span class="detail-mark">
        <VendorMark :vendor="draft.id" :name="displayName" :size="26" />
      </span>

      <div class="detail-copy">
        <h2 class="provider-detail-title">{{ displayName }}</h2>

        <div class="detail-sub">
          <span class="detail-id">{{ draft.id || t("settings.models.newProvider") }}</span>
          <span class="provider-badge">{{ t("settings.models.group.custom") }}</span>
        </div>
      </div>
    </header>

    <section class="detail-sec">
      <h3 class="sec-title">{{ t("settings.models.basicInfo") }}</h3>

      <div class="form-grid">
        <label class="field">
          <span class="field-label">
            {{ t("settings.models.providerId") }}
            <span class="required">*</span>
          </span>

          <TextFieldRoot
            v-model="draft.id"
            size="s"
            class="field-input"
            :disabled="isEdit"
            :data-invalid="errorField === 'id' ? '' : undefined"
          />
        </label>

        <label class="field">
          <span class="field-label">{{ t("settings.models.displayName") }}</span>
          <TextFieldRoot v-model="draft.name" size="s" class="field-input" />
        </label>

        <label class="field">
          <span class="field-label">
            {{ t("settings.models.baseUrl") }}
            <span class="required">*</span>
          </span>

          <TextFieldRoot
            v-model="draft.baseUrl"
            size="s"
            class="field-input"
            :data-invalid="errorField === 'baseUrl' ? '' : undefined"
          />
        </label>

        <label class="field">
          <span class="field-label">
            {{ t("settings.models.apiType") }}
            <span class="required">*</span>
          </span>

          <select v-model="draft.api" class="select-input">
            <option v-for="option in API_TYPES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="field span-2">
          <span class="field-label">{{ t("settings.models.apiKey") }}</span>

          <TextFieldRoot
            v-model="draft.apiKey"
            size="s"
            type="password"
            class="field-input"
            autocomplete="off"
            :placeholder="keyPlaceholder"
          />
        </label>
      </div>

      <p class="hint">{{ t("settings.models.apiKeyHint") }}</p>
      <p v-if="errorField" class="error">{{ t("settings.models.required") }}</p>
      <p v-if="actionError" class="error">{{ actionError }}</p>
    </section>

    <section class="detail-sec">
      <h3 class="sec-title">
        {{ t("settings.models.modelList") }}
        <span class="sec-count">
          {{ t("settings.models.modelCount", { count: draft.models.length }) }}
        </span>

        <button type="button" class="add-model" @click="addModel">
          + {{ t("settings.models.addModel") }}
        </button>
      </h3>

      <div class="model-cards">
        <CustomModelCard
          v-for="(item, index) in draft.models"
          :key="index"
          :model-value="item"
          @remove="removeModel(index)"
        />
      </div>
    </section>

    <div class="actions">
      <Button v-if="isEdit" variant="surface" color="red" @click="confirmDelete = true">
        {{ t("settings.models.deleteProvider") }}
      </Button>

      <Button :loading="saving" @click="save">{{ t("common.save") }}</Button>
    </div>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent class="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ t("settings.models.deleteProviderTitle", { name: displayName }) }}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {{ t("settings.models.deleteProviderBody") }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

          <AlertDialogAction variant="destructive" @click="remove">
            {{ t("settings.models.deleteProvider") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"
import { Button } from "@components/ui/button/index.js"
import { ArrowLeftIcon } from "@components/icons/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import CustomModelCard from "@features/settings/components/models/CustomModelCard.vue"
import {
  customProviderPayload,
  type CustomModelDraft,
  type CustomProviderDraft,
} from "@features/settings/lib/provider-view.js"
import { deleteCustomProvider, saveCustomProvider } from "@client/platform.js"
import { errorMessage } from "@client/http.js"
import { useI18n } from "@i18n/index.js"
import type { ProviderView } from "@/types/provider-type.js"

const props = defineProps<{ provider?: ProviderView }>()
const emit = defineEmits<{ cancel: []; saved: [id: string]; deleted: [id: string] }>()
const { t } = useI18n()
const saving = ref(false)
const confirmDelete = ref(false)
const errorField = ref<"id" | "baseUrl">()
const actionError = ref<string>()
const draft = reactive<CustomProviderDraft>(toDraft(props.provider))
const isEdit = computed(() => Boolean(props.provider))
const displayName = computed(() => draft.name || draft.id || t("settings.models.newProvider"))
const keyPlaceholder = computed(() =>
  props.provider?.status.configured ? t("settings.models.keySet") : "sk-…",
)
const API_TYPES = [
  { value: "openai-completions", label: "OpenAI Completions" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-generative-ai", label: "Google Generative AI" },
]

function toDraft(provider: ProviderView | undefined): CustomProviderDraft {
  if (!provider) {
    return {
      id: "",
      name: "",
      baseUrl: "",
      api: "openai-completions",
      apiKey: "",
      models: [],
    }
  }

  return {
    id: provider.id,
    name: provider.name,
    baseUrl: provider.baseUrl ?? "",
    api: provider.api ?? "openai-completions",
    apiKey: "",
    models: provider.models.map((model): CustomModelDraft => ({
      id: model.id,
      name: model.name,
      contextWindow: String(model.contextWindow ?? ""),
      maxTokens: String(model.maxTokens ?? ""),
      reasoning: model.reasoning,
      image: Array.isArray(model.input) && model.input.includes("image"),
      ...(model.samplingParams ? { samplingParams: model.samplingParams } : {}),
    })),
  }
}

function addModel() {
  draft.models.push({
    id: "",
    name: "",
    contextWindow: "",
    maxTokens: "",
    reasoning: false,
    image: false,
  })
}

function removeModel(index: number) {
  draft.models.splice(index, 1)
}

async function save() {
  const result = customProviderPayload(draft)

  if (!result.ok) {
    errorField.value = result.field
    return
  }

  errorField.value = undefined
  actionError.value = undefined
  saving.value = true

  try {
    await saveCustomProvider(result.payload)
    emit("saved", result.payload.id)
  } catch (cause) {
    actionError.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.provider) return
  actionError.value = undefined

  try {
    await deleteCustomProvider(props.provider.id)
    emit("deleted", props.provider.id)
  } catch (cause) {
    actionError.value = errorMessage(cause)
  }
}
</script>

<style scoped>
.provider-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  align-self: flex-start;
  height: 26px;
  margin-block-end: var(--space-md);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.back-icon {
  inline-size: 12px;
  block-size: 12px;
}

.detail-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-block-end: var(--space-md);
}

.detail-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
}

.detail-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.provider-detail-title {
  margin: 0;
  color: var(--contrast-foreground);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.detail-sub {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding-inline: 6px;
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-sm);
  background: var(--hover-quiet);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
}

.detail-sec {
  padding-block-start: var(--space-md);
}

.sec-title {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0 0 var(--space-sm);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body-sm--line-height);
}

.sec-count {
  color: var(--contrast-foreground-faint);
  font-weight: var(--font-weight-normal);
}

.add-model {
  margin-inline-start: auto;
  color: var(--primary);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-normal);
}

.add-model:hover {
  opacity: 0.8;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.span-2 {
  grid-column: 1 / -1;
}

.field-label {
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.required {
  margin-inline-start: 2px;
  color: var(--danger);
}

.field-input {
  font-size: var(--text-caption);
}

.field-input[data-invalid] {
  border-color: var(--danger);
}

.select-input {
  height: 30px;
  padding-inline: var(--space-sm);
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--background);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
}

.hint {
  margin: var(--space-xs) 0 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  line-height: 1.4;
}

.error {
  margin: var(--space-xs) 0 0;
  color: var(--danger);
  font-size: var(--text-eyebrow);
}

.model-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-block-start: var(--space-md);
}

.delete-dialog {
  max-inline-size: 26rem;
}

@media (max-width: 560px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
