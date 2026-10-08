<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="usage"
        :class="{ open }"
        :aria-label="usageLabel"
        @mousedown.prevent
        @click="emit('toggle')"
      >
        <svg class="usage-ring" width="16" height="16" viewBox="0 0 16 16">
          <circle class="usage-ring-track" cx="8" cy="8" r="6" />

          <circle
            class="usage-ring-fill"
            cx="8"
            cy="8"
            r="6"
            :stroke-dasharray="RING"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
      </button>
    </TooltipTrigger>

    <TooltipContent>{{ usageLabel }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import type { ContextUsage } from "@features/composer/type.js"

const props = withDefaults(
  defineProps<{
    usage: ContextUsage
    open?: boolean
  }>(),
  { open: false },
)
const emit = defineEmits<{
  toggle: []
}>()
const { t } = useI18n()
const RING = 2 * Math.PI * 6
const usageLabel = computed(() => t("composer.contextUsage") + " " + props.usage.percent + "%")
const ringOffset = computed(() => {
  const clamped = Math.min(100, Math.max(0, props.usage.percent))
  return RING * (1 - clamped / 100)
})
</script>

<style scoped>
.usage {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--primary-active);
  cursor: pointer;
}

.usage:hover,
.usage.open {
  color: var(--ink-muted);
  background: var(--hover-quiet);
}

.usage-ring {
  display: block;
  overflow: visible;
  transform: rotate(-90deg);
}

.usage-ring-track,
.usage-ring-fill {
  fill: none;
  stroke-width: 2.5;
}

.usage-ring-track {
  stroke: var(--chart-track);
}

.usage-ring-fill {
  stroke: currentColor;
  stroke-linecap: round;
}
</style>
