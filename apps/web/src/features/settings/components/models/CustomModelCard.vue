<template>
  <Card size="s" class="model-card">
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
        <TrashBinMinimalisticIcon />
      </IconButton>

      <IconButton
        type="button"
        class="icon-button"
        size="s"
        variant="ghost"
        :aria-label="t('settings.models.expandModel')"
        @click="open = !open"
      >
        <AltArrowRightIcon class="chevron" :class="{ open }" />
      </IconButton>
    </div>

    <div v-if="open" class="card-body">
      <div class="field-grid">
        <label class="field">
          <span class="field-label">{{ t("settings.models.modelId") }}</span>
          <TextFieldRoot v-model="model.id" size="s" class="field-input" />
        </label>

        <label class="field">
          <span class="field-label">{{ t("settings.models.displayName") }}</span>
          <TextFieldRoot v-model="model.name" size="s" class="field-input" />
        </label>

        <label class="field">
          <span class="field-label">{{ t("settings.models.contextWindow") }}</span>
          <TextFieldRoot v-model="model.contextWindow" size="s" class="field-input" />
        </label>

        <label class="field">
          <span class="field-label">{{ t("settings.models.maxTokens") }}</span>
          <TextFieldRoot v-model="model.maxTokens" size="s" class="field-input" />
        </label>
      </div>

      <div class="field-grid">
        <div class="field field-inline">
          <span class="field-label">{{ t("settings.models.imageInput") }}</span>
          <span class="switch-box"><Switch v-model="model.image" size="s" /></span>
        </div>

        <div class="field field-inline">
          <span class="field-label">{{ t("settings.models.reasoning") }}</span>
          <span class="switch-box"><Switch v-model="model.reasoning" size="s" /></span>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { ref } from "vue"

import { AltArrowRightIcon, TrashBinMinimalisticIcon } from "@components/icons/index.js"
import { Switch } from "@components/ui/switch/index.js"
import { TextFieldRoot } from "@components/ui/text-field/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import { IconButton } from "@components/ui/button/index.js"
import { useI18n } from "@i18n/index.js"
import type { CustomModelDraft } from "@features/settings/lib/provider-view.js"
import { Card } from "@components/ui/card/index.js"

const model = defineModel<CustomModelDraft>({ required: true })

defineProps<{ providerId?: string | undefined; providerName?: string | undefined }>()

const emit = defineEmits<{ remove: [] }>()
const { t } = useI18n()
const open = ref(!model.value.id)
</script>

<style scoped>
.model-card {
  padding: 0;
}

.card-head {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding-inline: var(--space-md);
  min-height: 44px;
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
  color: var(--contrast-foreground);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-meta {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.icon-button {
  color: var(--contrast-foreground-muted);
}

.icon-button:hover {
  color: var(--contrast-foreground);
}

.chevron {
  transition: transform var(--duration-fast) var(--ease-smooth);
}

.chevron.open {
  transform: rotate(90deg);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: 2px var(--space-md) var(--space-md);
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
  min-height: var(--size-control);
}

.field-label {
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
}

.field-input {
  font-size: var(--text-caption);
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
