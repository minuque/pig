<template>
  <div class="glass-shell usage-shell">
    <div class="glass-host usage-host">
      <div class="head">
        <h3 class="title">Context Usage</h3>
        <button type="button" class="close" aria-label="关闭上下文占用" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
      <div class="stats">
        <span class="percent">{{ usage.percent }}% 已用</span>
        <span class="tokens">{{ tokenSummary }}</span>
      </div>
      <div class="bar" role="img" :aria-label="tokenSummary">
        <span
          v-for="segment in usage.segments"
          :key="segment.id"
          class="bar-seg"
          :style="{
            width: `${segmentShare(segment.tokens, usage.window)}%`,
            background: segment.color,
          }"
        ></span>
      </div>
      <ul v-if="usage.segments.length" class="legend">
        <li v-for="segment in usage.segments" :key="segment.id" class="legend-row">
          <span class="swatch" :style="{ background: segment.color }"></span>
          <span class="legend-label">{{ segment.label }}</span>
          <span class="legend-count">{{ formatTokenCount(segment.tokens) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import {
  formatTokenCount,
  segmentShare,
  type ContextUsage,
} from "@features/chat-input/lib/context-usage.js";

export function contextUsageSummary(usage: ContextUsage): string {
  return `${formatTokenCount(usage.used)} / ${formatTokenCount(usage.window)} token`;
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps<{
  usage: ContextUsage;
}>();

const emit = defineEmits<{
  close: [];
}>();

const tokenSummary = computed(() => contextUsageSummary(props.usage));
</script>

<style scoped>
.usage-shell {
  position: relative;
  z-index: 10;
  margin-bottom: 8px;
}
.usage-host {
  position: relative;
  padding: 12px 14px 10px;
  background: var(--composer);
  border: var(--border-width) solid var(--composer-ring);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
}
.title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
}
.close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
}
.close:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.stats {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-xs);
  margin-top: 6px;
}
.percent {
  color: var(--ink-secondary);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.tokens {
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.bar {
  display: flex;
  overflow: hidden;
  height: 6px;
  margin-top: 10px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}
.bar-seg {
  display: block;
  flex: none;
  height: 100%;
  min-width: 0;
}
.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0 2px;
  padding: 0;
  list-style: none;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 18px;
  color: var(--ink-secondary);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.swatch {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend-label {
  min-width: 0;
  flex: 1;
}
.legend-count {
  flex: none;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}
</style>
