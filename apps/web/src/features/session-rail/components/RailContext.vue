<template>
  <div class="ctx">
    <div class="ctx-head">
      <span>{{ contextUsageSummary(usage) }}</span>
      <span class="ctx-percent">{{ usage.percent }}%</span>
    </div>

    <Meter :value="usage.percent" :format="{ style: 'percent' }" :aria-label="t('rail.context')">
      <MeterTrack class="ctx-meter">
        <i
          v-for="segment in used"
          :key="segment.id"
          :style="{
            inlineSize: `${segmentShare(segment.tokens, usage.window)}%`,
            background: segment.color,
          }"
        />
      </MeterTrack>
    </Meter>

    <ul class="ctx-legend">
      <li
        v-for="segment in rows"
        :key="segment.id"
        class="ctx-row"
        :data-idle="segment.id === 'idle' || undefined"
      >
        <span class="ctx-swatch" :style="{ background: segment.color }" />

        <Link
          v-if="canPreview(segment)"
          type="button"
          color="neutral"
          underline="hover"
          truncate
          class="ctx-label"
          @click="previewing = segment"
        >
          <template #render="{ props: part }">
            <button v-bind="part">
              {{ labelOf(segment) }}
            </button>
          </template>
        </Link>

        <span v-else class="ctx-label">{{ labelOf(segment) }}</span>
        <span class="ctx-tokens">{{ formatTokenCount(segment.tokens) }}</span>
        <span class="ctx-share">{{ share(segment) }}</span>
      </li>
    </ul>

    <RailContextPreview
      v-if="sessionId && previewing"
      open
      :session-id="sessionId"
      :segment="previewing"
      @update:open="previewing = undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { Link } from "@pig/ui/link"
import { Meter, MeterTrack } from "@pig/ui/meter"
import {
  contextUsageSummary,
  formatTokenCount,
  segmentShare,
} from "@features/composer/lib/context-usage.js"
import type { ContextUsage, ContextUsageSegment } from "@features/composer/type.js"
import RailContextPreview from "@features/session-rail/components/RailContextPreview.vue"

const props = defineProps<{ usage: ContextUsage; sessionId: string | undefined }>()
const { t } = useI18n()
const previewing = shallowRef<ContextUsageSegment>()
const used = computed(() =>
  props.usage.segments
    .filter((segment) => segment.id !== "idle" && segment.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens),
)
const mcpRow = computed(() =>
  props.usage.mcpToolCount > 0
    ? props.usage.segments.find((segment) => segment.id === "mcpTools" && segment.tokens === 0)
    : undefined,
)
const rows = computed(() => [
  ...used.value,
  ...(mcpRow.value ? [mcpRow.value] : []),
  ...props.usage.segments.filter((segment) => segment.id === "idle" && segment.tokens > 0),
])
const share = (segment: ContextUsageSegment) =>
  props.usage.window > 0 ? `${segmentShare(segment.tokens, props.usage.window).toFixed(1)}%` : "—"
const labelOf = (segment: ContextUsageSegment) =>
  segment.id === "mcpTools" && props.usage.mcpToolCount > 0
    ? t("rail.mcpLabel", { label: segment.label, count: props.usage.mcpToolCount })
    : segment.label
const canPreview = (segment: ContextUsageSegment) => Boolean(props.sessionId && segment.previewable)
</script>

<style scoped>
.ctx {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.ctx-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.ctx-percent {
  color: var(--fg);
}

.ctx-meter {
  display: flex;
  gap: 1px;
  block-size: var(--space-xs);
  overflow: hidden;
  background: var(--bg-emphasis);
  border-radius: var(--radius-pill);
}

.ctx-meter i {
  flex: none;
}

.ctx-legend {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ctx-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.ctx-swatch {
  flex: none;
  inline-size: var(--space-sm);
  block-size: var(--space-sm);
  border-radius: calc(var(--radius-control) / 3);
}

.ctx-label {
  flex: 1;
  min-inline-size: 0;
  text-align: start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctx-label[data-slot="link"] {
  text-decoration-color: currentColor;
}

.ctx-tokens {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.ctx-share {
  flex: none;
  min-inline-size: 44px;
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  text-align: end;
  white-space: nowrap;
}
</style>
