<template>
  <div
    class="timeline-minimap"
    :class="{ interactive: hitStripWidth > 0 }"
    data-testid="timeline-minimap"
    :style="{ width: hitAreaWidth }"
  >
    <div
      class="minimap-stage"
      :style="{ height: railHeight }"
      @focusout="onStageFocusOut"
      @mouseleave="activeIndex = null"
    >
      <button
        v-for="(item, index) in items"
        :key="item.id"
        class="minimap-tick"
        type="button"
        :style="tickStyle(index)"
        @mouseenter="activeIndex = index"
        @focus="activeIndex = index"
        @click="emit('select', item)"
      >
        <span
          class="minimap-strip"
          :class="resolvedActiveIndex === index ? 'strip-active' : 'strip-far'"
          :data-in-view="inViewIds.includes(item.id) ? 'true' : 'false'"
        ></span>
      </button>
      <span
        v-if="activeItem"
        class="minimap-preview"
        data-minimap-preview
        :style="{
          top: `${resolveMinimapTopPercent(resolvedActiveIndex ?? 0, items.length)}%`,
          transform: `translateY(${previewTranslate})`,
        }"
      >
        <span class="preview-card">
          <span class="preview-user">{{ activeItem.userText ?? "用户句" }}</span>
          <span v-if="activeItem.assistantText" class="preview-assistant">{{
            activeItem.assistantText
          }}</span>
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import type { TranscriptMinimapItem } from "@features/transcript-view/lib/transcript-minimap.js"
import {
  MINIMAP_RAIL_WIDTH,
  resolveMinimapHeightStyle,
  resolveMinimapTopPercent,
} from "@features/transcript-view/lib/transcript-minimap.js"

const props = defineProps<{
  items: readonly TranscriptMinimapItem[]
  inViewIds: readonly string[]
  hitStripWidth: number
}>()

const emit = defineEmits<{
  select: [item: TranscriptMinimapItem]
}>()

const activeIndex = shallowRef<number | null>(null)

const resolvedActiveIndex = computed(() => {
  const index = activeIndex.value
  return index !== null && index < props.items.length ? index : null
})
const activeItem = computed(() => {
  const index = resolvedActiveIndex.value
  return index === null ? null : (props.items[index] ?? null)
})
const previewTranslate = computed(() => {
  const index = resolvedActiveIndex.value
  if (index === null) return "-50%"
  if (index === 0) return "0%"
  if (index === props.items.length - 1) return "-100%"
  return "-50%"
})
const hitAreaWidth = computed(() => (props.hitStripWidth > 0 ? `${MINIMAP_RAIL_WIDTH}px` : "0px"))
const railHeight = computed(() => resolveMinimapHeightStyle(props.items.length))

function tickStyle(index: number): { top: string; height: string } {
  const count = Math.max(props.items.length, 1)
  return {
    top: `${(index / count) * 100}%`,
    height: `${100 / count}%`,
  }
}

function onStageFocusOut(event: FocusEvent) {
  const root = event.currentTarget
  const next = event.relatedTarget
  if (root instanceof Node && next instanceof Node && root.contains(next)) return
  activeIndex.value = null
}
</script>

<style scoped>
.timeline-minimap {
  pointer-events: none;
  position: sticky;
  top: 50%;
  z-index: 3;
  display: none;
  width: 44px;
  height: 0;
  margin-inline-start: var(--spacing-md);
  overflow: visible;
}
.timeline-minimap.interactive {
  pointer-events: auto;
}
.minimap-stage {
  position: relative;
  width: 100%;
  height: 100%;
  user-select: none;
  transform: translateY(-50%);
}
.minimap-tick {
  position: absolute;
  left: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.minimap-tick:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: 2px;
}
.minimap-strip {
  pointer-events: none;
  position: absolute;
  left: 0;
  top: 50%;
  height: 2px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--ink-muted) 35%, transparent);
  transform: translateY(-50%);
  transition:
    background var(--duration-fast) var(--ease-smooth),
    width var(--duration-fast) var(--ease-smooth);
}
.minimap-strip[data-in-view="true"] {
  background: color-mix(in srgb, var(--ink) 90%, transparent);
}
.minimap-strip.strip-far {
  width: 8px;
}
.minimap-strip.strip-active {
  width: 38px;
  background: var(--ink);
}
.minimap-preview {
  pointer-events: auto;
  position: absolute;
  left: 60px;
  width: 20rem;
  cursor: text;
  user-select: text;
}
.preview-card {
  display: block;
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-popover);
  text-align: left;
}
.preview-user {
  display: block;
  overflow: hidden;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-assistant {
  display: -webkit-box;
  max-height: 3.75rem;
  margin-top: 4px;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  line-height: 20px;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
@media (pointer: fine) {
  .timeline-minimap {
    display: block;
  }
}
@media (prefers-reduced-motion: reduce) {
  .minimap-strip {
    transition: none;
  }
}
</style>
