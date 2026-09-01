<template>
  <section class="pane">
    <div class="head">
      <p class="caption">{{ rangeCaption }}</p>
      <div class="ranges" role="tablist" aria-label="时间窗">
        <button
          v-for="item in ranges"
          :key="item.id"
          type="button"
          class="range"
          role="tab"
          :aria-selected="range === item.id"
          @click="range = item.id"
        >
          {{ item.short }}
        </button>
      </div>
    </div>
    <div class="tile">
      <p class="tile-label">Token</p>
      <p class="tile-value">—</p>
    </div>
    <div class="chart">
      <h3 class="chart-title">按模型</h3>
      <p class="empty">暂无用量数据</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"

const ranges = [
  { id: "day", short: "24小时", long: "最近 24 小时" },
  { id: "week", short: "7天", long: "最近 7 天" },
  { id: "month", short: "30天", long: "最近 30 天" },
  { id: "total", short: "全部", long: "全部历史" },
] as const

type UsageRange = (typeof ranges)[number]["id"]

const range = shallowRef<UsageRange>("day")
const rangeCaption = computed(
  () => ranges.find((item) => item.id === range.value)?.long ?? "最近 24 小时",
)
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
.caption {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}
.ranges {
  display: inline-flex;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
}
.range {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
}
.range:hover {
  color: var(--ink);
}
.range[aria-selected="true"] {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-soft);
}
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
}
.tile-label {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.tile-value {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-heading-2);
  font-weight: var(--font-weight-bold);
  line-height: var(--text-heading-2--line-height);
  letter-spacing: var(--tracking-heading-2);
  font-variant-numeric: tabular-nums;
}
.chart {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 8rem;
  padding: var(--spacing-md);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
}
.chart-title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-semibold);
}
.empty {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
}
</style>
