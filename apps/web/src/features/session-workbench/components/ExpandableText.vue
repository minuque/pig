<template>
  <div class="expand-text">
    <pre v-if="!virtual" class="expand-text-pre" :class="preClass">{{ text }}</pre>
    <pre
      v-else
      class="expand-text-pre expand-text-pre--virtual"
      :class="preClass"
      :style="{ height: `${maxLines * lineHeight}px` }"
      @scroll="onScroll"
    >
      <span class="expand-text-canvas" :style="{ height: `${totalHeight}px` }">
        <span class="expand-text-window" :style="{ top: `${padTop}px` }">{{ visibleText }}</span>
      </span>
    </pre>
    <p v-if="virtual && showCount" class="expand-text-meta">{{ lines.length }} 行</p>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";
import {
  DEFAULT_LINE_HEIGHT_PX,
  DEFAULT_MAX_EXPAND_LINES,
  DEFAULT_OVERSCAN_LINES,
  splitLines,
  visibleLineRange,
} from "@features/session-workbench/expandable-text.js";

const props = withDefaults(
  defineProps<{
    text: string;
    maxLines?: number;
    lineHeight?: number;
    tone?: "code" | "plain";
    showCount?: boolean;
  }>(),
  {
    maxLines: DEFAULT_MAX_EXPAND_LINES,
    lineHeight: DEFAULT_LINE_HEIGHT_PX,
    tone: "code",
    showCount: true,
  },
);

const preClass = computed(() => ({ "expand-text-pre--plain": props.tone === "plain" }));

const scrollTop = shallowRef(0);
const lines = computed(() => splitLines(props.text));
const virtual = computed(() => lines.value.length > props.maxLines);
const range = computed(() =>
  virtual.value
    ? visibleLineRange(
        scrollTop.value,
        props.lineHeight,
        props.maxLines,
        lines.value.length,
        DEFAULT_OVERSCAN_LINES,
      )
    : { start: 0, end: lines.value.length },
);
const visibleText = computed(() =>
  lines.value.slice(range.value.start, range.value.end).join("\n"),
);
const padTop = computed(() => range.value.start * props.lineHeight);
const totalHeight = computed(() => lines.value.length * props.lineHeight);

function onScroll(event: Event) {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop;
}
</script>

<style scoped>
.expand-text-pre {
  position: relative;
  margin: var(--spacing-xxs) 0 0;
  padding: var(--spacing-sm);
  overflow: auto;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
  color: var(--ink-secondary);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 21px;
  white-space: pre;
  tab-size: 2;
}
.expand-text-pre--plain {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: pre-wrap;
}
.expand-text-pre--virtual {
  overflow: auto;
}
.expand-text-canvas {
  position: relative;
  display: block;
}
.expand-text-window {
  position: absolute;
  inset-inline: 0;
  display: block;
}
.expand-text-meta {
  margin: 4px 0 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
}
</style>
