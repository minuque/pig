<template>
  <div class="nav-shift" role="group" aria-label="会话分组方式">
    <button
      class="nav-shift-hit press-scale"
      type="button"
      data-side="prev"
      :disabled="!prev"
      title="按目录"
      aria-label="按目录"
      @click="shift(prev)"
    >
      <ChevronLeft class="size-icon" />
    </button>
    <button
      class="nav-shift-hit press-scale"
      type="button"
      data-side="next"
      :disabled="!next"
      title="按更新时间"
      aria-label="按更新时间"
      @click="shift(next)"
    >
      <ChevronRight class="size-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronLeft, ChevronRight } from "@lucide/vue"
import type { SidebarGrouping } from "@features/session-nav/type.js"

const groupingOrder = ["project", "updated"] as const satisfies readonly SidebarGrouping[]

const props = defineProps<{
  grouping: SidebarGrouping
}>()

const emit = defineEmits<{
  setGrouping: [grouping: SidebarGrouping]
}>()

const index = computed(() => groupingOrder.indexOf(props.grouping))
const prev = computed(() => groupingOrder[index.value - 1])
const next = computed(() => groupingOrder[index.value + 1])

function shift(mode: SidebarGrouping | undefined) {
  if (mode) emit("setGrouping", mode)
}
</script>

<style scoped>
.nav-shift {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.nav-shift-hit {
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--panel);
  color: var(--ink-muted);
  translate: 0 -50%;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
.nav-shift-hit[data-side="prev"] {
  inset-inline-start: var(--spacing-xxs);
}
.nav-shift-hit[data-side="next"] {
  inset-inline-end: var(--spacing-xxs);
}
.nav-shift-hit:hover:not(:disabled) {
  color: var(--ink);
  background: var(--hover-quiet);
}
</style>
