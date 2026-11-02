<template>
  <div class="model-list">
    <p v-if="error" class="list-error">{{ error }}</p>

    <div v-for="model in provider.models" :key="model.id" class="model-card">
      <div class="model-row">
        <button
          type="button"
          class="model-toggle"
          :aria-expanded="expanded === model.id"
          @click="toggle(model.id)"
        >
          <VendorMark class="model-icon" :vendor="provider.id" :name="provider.name" :size="16" />

          <span class="model-copy">
            <span class="model-name">{{ model.name }}</span>
            <span class="model-meta">{{ modelMeta(model) }}</span>
          </span>
        </button>

        <Switch
          :model-value="model.enabled"
          size="s"
          :disabled="busy === model.id"
          :aria-label="t('settings.models.modelEnabled', { name: model.name })"
          @update:model-value="toggleEnabled(model, $event)"
        />

        <button
          type="button"
          class="chevron-button"
          :aria-expanded="expanded === model.id"
          :aria-label="t('settings.models.expandModel')"
          @click="toggle(model.id)"
        >
          <AltArrowRightIcon class="chevron" :data-open="expanded === model.id ? '' : undefined" />
        </button>
      </div>

      <Transition name="panel-reveal">
        <ModelParamsForm
          v-if="expanded === model.id"
          :key="model.id"
          :provider-id="provider.id"
          :model="model"
          @saved="emit('changed')"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

import { AltArrowRightIcon } from "@components/icons/index.js"
import { Switch } from "@components/ui/switch/index.js"
import VendorMark from "@features/composer/components/VendorMark.vue"
import ModelParamsForm from "@features/settings/components/models/ModelParamsForm.vue"
import { errorMessage } from "@client/http.js"
import { setModelEnabled } from "@client/platform.js"
import { modelMeta } from "@features/settings/lib/provider-view.js"
import { useI18n } from "@i18n/index.js"
import type { ProviderModelView, ProviderView } from "@/types/provider-type.js"

const props = defineProps<{ provider: ProviderView }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const expanded = ref<string>()
const busy = ref<string>()
const error = ref<string>()

function toggle(modelId: string) {
  expanded.value = expanded.value === modelId ? undefined : modelId
}

async function toggleEnabled(model: ProviderModelView, enabled: boolean) {
  busy.value = model.id
  error.value = undefined

  try {
    await setModelEnabled(props.provider.id, model.id, enabled)
    emit("changed")
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = undefined
  }
}
</script>

<style scoped>
.model-list {
  border: var(--border-width) solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--card);
  overflow: hidden;
}

.model-card + .model-card {
  border-block-start: var(--border-width) solid var(--border-subtle);
}

.model-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: 40px;
  padding-inline: var(--space-sm);
}

.model-toggle {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  text-align: start;
}

.model-icon {
  flex: none;
}

.model-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.model-name {
  color: var(--contrast-foreground);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
}

.model-meta {
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.model-row:hover {
  background: var(--hover-quiet);
}

.chevron-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--contrast-foreground-faint);
}

.chevron-button:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.chevron {
  inline-size: 13px;
  block-size: 13px;
  transition: transform var(--duration-fast) var(--ease-smooth);
}

.chevron[data-open] {
  transform: rotate(90deg);
}

.list-error {
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  color: var(--danger);
  font-size: var(--text-eyebrow);
}
</style>
