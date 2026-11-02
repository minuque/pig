<template>
  <div class="model-list">
    <div v-for="model in provider.models" :key="model.id" class="model-card">
      <button
        type="button"
        class="model-row"
        :aria-expanded="expanded === model.id"
        @click="toggle(model.id)"
      >
        <span class="model-copy">
          <span class="model-name">{{ model.name }}</span>
          <span class="model-meta">{{ modelMeta(model) }}</span>
        </span>

        <AltArrowDownIcon class="chevron" :data-open="expanded === model.id ? '' : undefined" />
      </button>

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

import { AltArrowDownIcon } from "@components/icons/index.js"
import ModelParamsForm from "@features/settings/components/models/ModelParamsForm.vue"
import { modelMeta } from "@features/settings/lib/provider-view.js"
import type { ProviderView } from "@/types/provider-type.js"

const props = defineProps<{ provider: ProviderView }>()
const emit = defineEmits<{ changed: [] }>()
const expanded = ref<string>()

function toggle(modelId: string) {
  expanded.value = expanded.value === modelId ? undefined : modelId
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
  gap: var(--space-sm);
  width: 100%;
  height: 40px;
  padding-inline: var(--space-sm);
  text-align: start;
}

.model-row:hover {
  background: var(--hover-quiet);
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

.chevron {
  flex: none;
  inline-size: 13px;
  block-size: 13px;
  margin-inline-start: auto;
  color: var(--contrast-foreground-faint);
  transition: transform var(--duration-fast) var(--ease-smooth);
}

.chevron[data-open] {
  transform: rotate(180deg);
}
</style>
