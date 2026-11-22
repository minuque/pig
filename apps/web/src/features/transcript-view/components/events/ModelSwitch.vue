<template>
  <span class="model-switch">
    <span class="model-side">
      <template v-if="changed.model && from.model">
        <VendorMark :vendor="from.model.provider" :size="12" />
        <span class="model-name">{{ modelName(from.model) }}</span>
      </template>

      <template v-else-if="!changed.model && current">
        <VendorMark :vendor="current.provider" :size="12" />
        <span class="model-name">{{ modelName(current) }}</span>
      </template>

      <span v-if="changed.thinkingLevel && from.thinkingLevel" class="model-effort">
        {{ formatThinkingLevel(from.thinkingLevel) }}
      </span>
    </span>

    <ArrowRightIcon class="size-icon-sm" aria-hidden="true" />

    <span class="model-side">
      <template v-if="changed.model && to.model">
        <VendorMark :vendor="to.model.provider" :size="12" />
        <span class="model-name">{{ modelName(to.model) }}</span>
      </template>

      <span v-if="changed.thinkingLevel && to.thinkingLevel" class="model-effort">
        {{ formatThinkingLevel(to.thinkingLevel) }}
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue"
import VendorMark from "@components/icons/VendorMark.vue"
import { ArrowRightIcon } from "@components/icons/index.js"
import { formatThinkingLevel } from "@features/composer/lib/thinking-level.js"
import { settingChanged } from "@features/transcript-view/lib/transcript-events.js"
import { useModelName } from "@features/transcript-view/lib/transcript-models.js"
import type { ModelSetting } from "@features/transcript-view/type.js"

const props = defineProps<{ from: ModelSetting; to: ModelSetting }>()
const modelName = useModelName()
const changed = computed(() => settingChanged(props.from, props.to))
const current = computed(() => props.to.model ?? props.from.model)
</script>

<style scoped>
.model-switch,
.model-side {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  white-space: nowrap;
}

.model-switch {
  gap: var(--space-xs);
}

.model-name {
  color: var(--fg-secondary);
  font-weight: var(--font-weight-medium);
}
</style>
