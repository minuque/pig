<template>
  <CardList class="model-card">
    <Collapsible v-model:open="open">
      <div class="card-head">
        <button type="button" class="card-toggle" @click="open = !open">
          <VendorMark class="model-icon" :vendor="providerId" :name="providerName" :size="16" />
          <span class="model-name">{{ model.id || t("settings.models.newModel") }}</span>
          <span class="model-meta">{{ model.contextWindow || "—" }}</span>
        </button>

        <IconButton
          type="button"
          class="icon-button"
          size="s"
          variant="ghost"
          :aria-label="t('settings.models.removeModel')"
          @click="emit('remove')"
        >
          <TrashIcon />
        </IconButton>

        <IconButton
          type="button"
          class="icon-button"
          size="s"
          variant="ghost"
          :aria-label="t('settings.models.expandModel')"
          @click="open = !open"
        >
          <ChevronRightIcon class="chevron" :class="{ open }" />
        </IconButton>
      </div>

      <CollapsibleContent>
        <div class="card-body">
          <div class="field-grid">
            <Field class="field">
              <FieldLabel class="field-label">{{ t("settings.models.modelId") }}</FieldLabel>
              <TextFieldRoot v-model="model.id" size="s" class="field-input" />
            </Field>

            <Field class="field">
              <FieldLabel class="field-label">{{ t("settings.models.displayName") }}</FieldLabel>
              <TextFieldRoot v-model="model.name" size="s" class="field-input" />
            </Field>

            <Field class="field">
              <FieldLabel class="field-label">{{ t("settings.models.contextWindow") }}</FieldLabel>
              <TextFieldRoot v-model="model.contextWindow" size="s" class="field-input" />
            </Field>

            <Field class="field">
              <FieldLabel class="field-label">{{ t("settings.models.maxTokens") }}</FieldLabel>
              <TextFieldRoot v-model="model.maxTokens" size="s" class="field-input" />
            </Field>
          </div>

          <div class="field-grid">
            <Field class="field field-inline">
              <FieldLabel class="field-label">{{ t("settings.models.imageInput") }}</FieldLabel>
              <span class="switch-box"><Switch v-model="model.image" size="s" /></span>
            </Field>

            <Field class="field field-inline">
              <FieldLabel class="field-label">{{ t("settings.models.reasoning") }}</FieldLabel>
              <span class="switch-box"><Switch v-model="model.reasoning" size="s" /></span>
            </Field>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </CardList>
</template>

<script setup lang="ts">
import { ref } from "vue"

import { ChevronRightIcon, TrashIcon } from "@components/icons/index.js"
import { Switch } from "@pig/ui/switch"
import { Field, FieldLabel } from "@pig/ui/field"
import { TextFieldRoot } from "@pig/ui/text-field"
import VendorMark from "@components/icons/VendorMark.vue"
import { IconButton } from "@pig/ui/button"
import { useI18n } from "@i18n/index.js"
import type { CustomModelDraft } from "@features/settings/lib/provider-view.js"
import { CardList } from "@pig/ui/card"
import { Collapsible, CollapsibleContent } from "@pig/ui/collapsible"

const model = defineModel<CustomModelDraft>({ required: true })

defineProps<{ providerId?: string | undefined; providerName?: string | undefined }>()

const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()
const open = ref(!model.value.id)
</script>

<style scoped>
.card-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-inline: var(--card-padding);
  min-height: 52px;
}

.card-toggle {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: var(--space-sm);
  text-align: start;
}

.model-icon {
  flex: none;
}

.model-name {
  overflow: hidden;
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.icon-button {
  color: var(--fg-secondary);
}

.icon-button:hover {
  color: var(--fg);
}

.chevron {
  transition: transform var(--duration-fast) var(--ease-out);
}

.chevron.open {
  transform: rotate(90deg);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: 2px var(--card-padding) var(--card-padding);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: var(--control-lg);
}

.field-label {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.field-input {
  font-size: var(--text-meta);
}

.switch-box {
  display: flex;
  align-items: center;
  height: 24px;
}

@media (max-width: 560px) {
  .field-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
