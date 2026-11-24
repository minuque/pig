<template>
  <CardList>
    <p v-if="error" class="list-error">{{ error }}</p>

    <CardRow v-for="model in provider.models" :key="model.id" bleed class="model-card">
      <Collapsible :open="expanded === model.id" @update:open="toggle(model.id)">
        <div class="model-row">
          <CollapsibleTrigger as-child>
            <button type="button" class="model-toggle">
              <VendorMark
                class="model-icon"
                :vendor="provider.id"
                :name="provider.name"
                :size="16"
              />

              <span class="model-copy">
                <span class="model-name">{{ model.name }}</span>
                <span class="model-meta">{{ modelMeta(model) }}</span>
              </span>
            </button>
          </CollapsibleTrigger>

          <Switch
            :model-value="model.enabled"
            size="s"
            :disabled="busy === model.id"
            :aria-label="t('settings.models.modelEnabled', { name: model.name })"
            @update:model-value="toggleEnabled(model, $event)"
          />

          <CollapsibleTrigger as-child>
            <IconButton
              type="button"
              size="s"
              variant="ghost"
              color="neutral"
              class="chevron-button"
              :aria-label="t('settings.models.expandModel')"
            >
              <ChevronRightIcon
                class="chevron"
                :data-open="expanded === model.id ? '' : undefined"
              />
            </IconButton>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <ModelParamsForm
            :key="model.id"
            :provider-id="provider.id"
            :model="model"
            @saved="emit('changed')"
          />
        </CollapsibleContent>
      </Collapsible>
    </CardRow>
  </CardList>
</template>

<script setup lang="ts">
import { ref } from "vue"

import { ChevronRightIcon } from "@components/icons/index.js"
import { IconButton } from "@pig/ui/button"
import { Switch } from "@pig/ui/switch"
import VendorMark from "@components/icons/VendorMark.vue"
import ModelParamsForm from "@features/settings/components/models/ModelParamsForm.vue"
import { errorMessage } from "@client/http.js"
import { setModelEnabled } from "@client/platform.js"
import { modelMeta } from "@features/settings/lib/provider-view.js"
import { useI18n } from "@i18n/index.js"
import type { ProviderModelView, ProviderView } from "@/types/common-type.js"
import { CardList, CardRow } from "@pig/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"

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
.model-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 52px;
  padding-inline: var(--card-padding);
}

.model-toggle {
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

.model-copy {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: var(--space-xs);
}

.model-name {
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.model-meta {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.model-row:hover {
  background: var(--bg-hover);
}

.chevron {
  inline-size: 13px;
  block-size: 13px;
  transition: transform var(--duration-fast) var(--ease-out);
}

.chevron[data-open] {
  transform: rotate(90deg);
}

.list-error {
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  color: var(--danger-text);
  font-size: var(--text-meta);
}
</style>
