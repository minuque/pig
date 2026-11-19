<template>
  <div class="ctx">
    <div class="ctx-head">
      <span>{{ contextUsageSummary(usage) }}</span>
      <span class="ctx-percent">{{ usage.percent }}%</span>
    </div>

    <!-- 分类堆叠的用量条：每段一个分类，底槽是剩余空间 -->
    <div
      class="ctx-meter"
      role="meter"
      :aria-valuenow="usage.percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="t('rail.context')"
    >
      <i
        v-for="segment in used"
        :key="segment.id"
        :style="{
          inlineSize: `${segmentShare(segment.tokens, usage.window)}%`,
          background: segment.color,
        }"
      />
    </div>

    <ul class="ctx-legend">
      <li v-for="segment in rows" :key="segment.id">
        <component
          :is="canPreview(segment) ? 'button' : 'div'"
          :type="canPreview(segment) ? 'button' : undefined"
          class="ctx-row"
          :data-idle="segment.id === 'idle' || undefined"
          @click="canPreview(segment) && (previewing = segment)"
        >
          <span class="ctx-swatch" :style="{ background: segment.color }" />
          <span class="ctx-label">{{ segment.label }}</span>
          <span class="ctx-tokens">{{ formatTokenCount(segment.tokens) }}</span>
          <span class="ctx-share">{{ share(segment) }}</span>
        </component>
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
import {
  contextUsageSummary,
  formatTokenCount,
  segmentShare,
} from "@features/composer/lib/context-usage.js"
import type { ContextUsage, ContextUsageSegment } from "@features/composer/type.js"
import RailContextPreview from "@features/session-rail/components/RailContextPreview.vue"

const props = defineProps<{ usage: ContextUsage; sessionId: string | undefined }>()
const { t } = useI18n()
/** 点开预览的分类；弹框关掉就清空。 */
const previewing = shallowRef<ContextUsageSegment>()
/** 已占用的分类按 token 从多到少排；剩余空间单列在最后。 */
const used = computed(() =>
  props.usage.segments
    .filter((segment) => segment.id !== "idle" && segment.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens),
)
const rows = computed(() => [
  ...used.value,
  ...props.usage.segments.filter((segment) => segment.id === "idle" && segment.tokens > 0),
])
const share = (segment: ContextUsageSegment) =>
  props.usage.window > 0 ? `${segmentShare(segment.tokens, props.usage.window).toFixed(1)}%` : "—"
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
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 一行：色块 · 分类名 · token 数 · 占比 */
.ctx-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  inline-size: 100%;
  min-block-size: var(--control-sm);
  padding: 0 var(--space-2xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-faint);
  font: inherit;
  font-size: var(--text-meta);
  text-align: start;
}

button.ctx-row {
  cursor: pointer;
}

button.ctx-row:hover {
  background: var(--bg-hover);
  color: var(--fg);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ctx-tokens {
  flex: none;
  font-variant-numeric: tabular-nums;
}

.ctx-share {
  flex: none;
  min-inline-size: var(--legend-share);
  /* 占比是这一行的主数据，用一级文本色 */
  color: var(--fg);
  font-variant-numeric: tabular-nums;
  text-align: end;
  white-space: nowrap;
}
</style>
