<template>
  <HoverCard>
    <HoverCardTrigger>
      <template #render="{ props: part }">
        <span
          v-bind="part"
          class="ring-trigger"
          role="img"
          :aria-label="`${t('composer.contextUsageBreakdown')} ${usage.percent}%`"
        >
          <svg
            class="context-ring"
            :data-severity="severity"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
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
        </span>
      </template>
    </HoverCardTrigger>

    <HoverCardContent side="top" align="end" size="s">
      <div class="usage-card" @click.stop @pointerdown.stop @keydown.stop>
        <div class="card-head">
          <span class="card-total">{{ contextUsageSummary(usage) }}</span>
          <span class="card-percent">{{ usage.percent }}%</span>
        </div>

        <dl class="card-metrics">
          <div v-for="metric in metrics" :key="metric.id" class="metric">
            <dt class="metric-label">{{ metric.label }}</dt>
            <dd class="metric-value">{{ metric.value }}</dd>
          </div>
        </dl>

        <ul v-if="segments.length" class="card-legend">
          <li v-for="segment in segments" :key="segment.id" class="legend-row">
            <span class="legend-dot" :style="{ background: segment.color }" />
            <span class="legend-label">{{ segment.label }}</span>
            <span class="legend-share">{{ share(segment.tokens) }}</span>
            <span class="legend-tokens">{{ formatTokenCount(segment.tokens) }}</span>
          </li>
        </ul>

        <div class="card-foot">
          <Button
            type="button"
            size="s"
            variant="ghost"
            color="neutral"
            class="card-compact"
            :disabled="compactDisabled"
            @click="emit('compact')"
          >
            <Minimize2Icon aria-hidden="true" />
            {{ t("composer.compactContext") }}
          </Button>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@pig/ui/button"
import { Minimize2Icon } from "@components/icons/index.js"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pig/ui/hover-card"
import {
  contextSeverity,
  contextUsageSummary,
  formatTokenCount,
  segmentShare,
} from "@features/composer/lib/context-usage.js"
import type { ContextUsage } from "@features/composer/type.js"

const props = defineProps<{ usage: ContextUsage; compactDisabled?: boolean }>()
const emit = defineEmits<{ compact: [] }>()
const { t } = useI18n()
const severity = computed(() => contextSeverity(props.usage.percent))
const segments = computed(() =>
  props.usage.segments
    .filter((segment) => segment.id !== "idle" && segment.tokens > 0)
    .sort((left, right) => right.tokens - left.tokens),
)
const metrics = computed(() => {
  const tokens = props.usage.tokens
  const count = (value: number | undefined) =>
    value === undefined ? "--" : formatTokenCount(value)
  const rate = tokens?.cacheHitRate
  return [
    { id: "input", label: t("composer.contextInput"), value: count(tokens?.input) },
    { id: "output", label: t("composer.contextOutput"), value: count(tokens?.output) },
    { id: "cacheRead", label: t("composer.contextCacheRead"), value: count(tokens?.cacheRead) },
    { id: "cacheWrite", label: t("composer.contextCacheWrite"), value: count(tokens?.cacheWrite) },
    {
      id: "cacheHitRate",
      label: t("composer.contextCacheHitRate"),
      value: rate === undefined || rate === null ? "--" : `${rate}%`,
    },
  ]
})
const share = (tokens: number) =>
  props.usage.window > 0 ? `${segmentShare(tokens, props.usage.window).toFixed(1)}%` : "--"
</script>

<style scoped>
.ring-trigger {
  display: inline-flex;
  flex: none;
}

.context-ring {
  display: block;
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

.usage-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-inline-size: 216px;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
  font-variant-numeric: tabular-nums;
}

.card-percent {
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

.card-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  margin: 0;
}

.metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
}

.metric-label {
  min-inline-size: 0;
  color: var(--fg-muted);
}

.metric-value {
  margin: 0;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}

.card-foot {
  padding-block-start: var(--space-xs);
  border-block-start: var(--border-width) solid var(--border-subtle);
}

.card-compact {
  height: var(--control-xs);
  margin-inline-start: calc(var(--space-2xs) * -1);
  padding-inline: var(--space-2xs);
  font-size: var(--text-meta);
}

.card-legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  margin: 0;
  padding-block-start: var(--space-xs);
  border-block-start: var(--border-width) solid var(--border-subtle);
  list-style: none;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.legend-dot {
  flex: none;
  inline-size: var(--space-2xs);
  block-size: var(--space-2xs);
  border-radius: var(--radius-pill);
}

.legend-label {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-share,
.legend-tokens {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.legend-share {
  color: var(--fg-muted);
}

.legend-tokens {
  color: var(--fg);
  min-inline-size: 44px;
  text-align: end;
}

@media (prefers-reduced-motion: reduce) {
  .ring-fill {
    transition: none;
  }
}
</style>
