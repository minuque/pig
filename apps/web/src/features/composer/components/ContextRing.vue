<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <button
        type="button"
        class="ring-trigger"
        :aria-label="`${t('composer.contextUsageBreakdown')} ${usage.percent}%`"
      >
        <svg class="context-ring" :data-severity="severity" viewBox="0 0 16 16" aria-hidden="true">
          <circle class="ring-track" cx="8" cy="8" r="6.75" pathLength="100" />

          <circle
            class="ring-fill"
            cx="8"
            cy="8"
            r="6.75"
            pathLength="100"
            :stroke-dasharray="`${usage.percent} 100`"
          />
        </svg>
      </button>
    </TooltipTrigger>

    <TooltipContent class="ring-tip">
      <span class="tip-total">{{ contextUsageSummary(usage) }} · {{ usage.percent }}%</span>

      <span v-for="segment in segments" :key="segment.id" class="tip-row">
        <span class="tip-dot" :style="{ background: segment.color }" />
        <span class="tip-label">{{ segment.label }}</span>
        <span class="tip-tokens">{{ formatTokenCount(segment.tokens) }}</span>
      </span>
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import {
  contextSeverity,
  contextUsageSummary,
  formatTokenCount,
} from "@features/composer/lib/context-usage.js"
import type { ContextUsage } from "@features/composer/type.js"

const props = defineProps<{ usage: ContextUsage }>()
const { t } = useI18n()
const severity = computed(() => contextSeverity(props.usage.percent))
const segments = computed(() =>
  props.usage.segments
    .filter((segment) => segment.id !== "idle" && segment.tokens > 0)
    .sort((left, right) => right.tokens - left.tokens),
)
</script>

<style scoped>
.ring-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  cursor: pointer;
}

.context-ring {
  flex: none;
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
  rotate: -90deg;
  color: var(--info-solid);
}

.context-ring[data-severity="warning"] {
  color: var(--warning-text);
}

.context-ring[data-severity="critical"] {
  color: var(--danger-text);
}

.ring-track,
.ring-fill {
  fill: none;
  stroke-width: 2;
}

.ring-track {
  stroke: var(--bg-emphasis);
}

.ring-fill {
  stroke: currentColor;
  stroke-linecap: round;
  transition: stroke-dasharray var(--duration-slow) var(--ease-out);
}

.tip-total {
  display: block;
  font-variant-numeric: tabular-nums;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
}

.tip-dot {
  flex: none;
  inline-size: var(--space-2xs);
  block-size: var(--space-2xs);
  border-radius: var(--radius-pill);
}

.tip-tokens {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .ring-fill {
    transition: none;
  }
}
</style>
