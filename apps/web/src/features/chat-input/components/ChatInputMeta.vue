<template>
  <div class="meta">
    <span v-if="cwdLabel" class="cwd" :title="cwd">
      <Folder :size="14" :stroke-width="1.5" />
      <span class="cwd-name">{{ cwdLabel }}</span>
    </span>
    <span v-else class="cwd-spacer"></span>
    <button
      v-if="usage"
      type="button"
      class="usage"
      :class="{ open }"
      :title="usageLabel"
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
  </div>
</template>

<script lang="ts">
import { workspaceName } from "@features/session-nav/index.js"
import type { ContextUsage } from "@features/chat-input/lib/context-usage.js"

const RING_RADIUS = 6
export const USAGE_RING_LENGTH = 2 * Math.PI * RING_RADIUS

export function usageRingOffset(percent: number, length = USAGE_RING_LENGTH): number {
  const clamped = Math.min(100, Math.max(0, percent))
  return length * (1 - clamped / 100)
}

export function chatInputCwdLabel(cwd: string | undefined): string {
  return cwd ? workspaceName(cwd) : ""
}

export function contextUsageTitle(usage: ContextUsage | undefined): string {
  const percent = usage?.percent ?? 0
  return `上下文占用 ${percent}%`
}
</script>

<script setup lang="ts">
import { computed } from "vue"
import { Folder } from "lucide-vue-next"

const props = withDefaults(
  defineProps<{
    cwd?: string | undefined
    usage?: ContextUsage | undefined
    open?: boolean
  }>(),
  { cwd: undefined, usage: undefined, open: false },
)

const emit = defineEmits<{
  toggle: []
}>()

const RING = USAGE_RING_LENGTH
const cwdLabel = computed(() => chatInputCwdLabel(props.cwd))
const usageLabel = computed(() => contextUsageTitle(props.usage))
const ringOffset = computed(() => usageRingOffset(props.usage?.percent ?? 0))
</script>

<style scoped>
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  background: var(--surface);
  min-height: 28px;
}
.cwd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 70%;
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.cwd-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cwd-spacer {
  min-width: 0;
}
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
.usage:hover {
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
  stroke: color-mix(in srgb, var(--ink) 18%, transparent);
}
.usage-ring-fill {
  stroke: currentColor;
  stroke-linecap: round;
}
</style>
