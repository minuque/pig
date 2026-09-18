<template>
  <div
    class="timeline-minimap"
    :class="{ interactive: hitStripWidth > 0 }"
    data-testid="timeline-minimap"
    :style="{ width: hitAreaWidth, height: railHeight }"
  >
    <div class="minimap-stage" @focusout="onStageFocusOut" @mouseleave="hoverIndex = null">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        class="minimap-tick"
        type="button"
        :style="tickStyle(index)"
        @mouseenter="hoverIndex = index"
        @focus="hoverIndex = index"
        @click="emit('select', item)"
      >
        <span
          class="minimap-strip"
          :class="{ 'strip-active': emphasizedIndex === index }"
          :style="{ width: stripWidth(index) }"
        ></span>
      </button>

      <span
        v-if="hoverItem"
        class="minimap-preview"
        data-minimap-preview
        :style="{
          top: `${resolveMinimapTopPercent(hoverIndex ?? 0, items.length)}%`,
          transform: `translateY(${previewTranslate})`,
        }"
      >
        <span class="preview-card">
          <span class="preview-user">{{ hoverItem.userText ?? "用户句" }}</span>

          <span v-if="hoverItem.assistantText" class="preview-assistant">
            {{ hoverItem.assistantText }}
          </span>
        </span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import type { TranscriptMinimapItem } from "@features/transcript-view/type.js"
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
const hoverIndex = shallowRef<number | null>(null)
const pinnedIndex = shallowRef(0)

watch(
  () => [props.inViewIds, props.items] as const,
  ([ids, items]) => {
    for (const id of ids) {
      const index = items.findIndex((item) => item.id === id)

      if (index >= 0) {
        pinnedIndex.value = index
        return
      }
    }

    if (pinnedIndex.value >= items.length) pinnedIndex.value = Math.max(0, items.length - 1)
  },
  { immediate: true },
)

const lastIndex = computed(() => Math.max(0, props.items.length - 1))
const emphasizedIndex = computed(() => {
  const hover = hoverIndex.value

  if (hover !== null && hover <= lastIndex.value) return hover
  return Math.min(pinnedIndex.value, lastIndex.value)
})
const hoverItem = computed(() => {
  const index = hoverIndex.value
  return index === null ? null : (props.items[index] ?? null)
})
const previewTranslate = computed(() => {
  const index = hoverIndex.value

  if (index === null) return "-50%"

  if (index === 0) return "0%"

  if (index === lastIndex.value) return "-100%"
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

function stripWidth(index: number): string {
  if (hoverIndex.value === null) return "8px"
  const distance = Math.abs(index - emphasizedIndex.value)
  const scale = distance === 0 ? 1 : distance === 1 ? 0.68 : distance === 2 ? 0.44 : 0.25
  return `${Math.round(38 * scale)}px`
}

function onStageFocusOut(event: FocusEvent) {
  const root = event.currentTarget
  const next = event.relatedTarget

  if (root instanceof Node && next instanceof Node && root.contains(next)) return
  hoverIndex.value = null
}
</script>

<style scoped>
.timeline-minimap {
  pointer-events: none;
  position: absolute;
  top: 50%;
  inset-inline-start: var(--spacing-md);
  z-index: 3;
  display: none;
  width: 44px;
  transform: translateY(-50%);
}

.timeline-minimap.interactive {
  pointer-events: auto;
}

.minimap-stage {
  position: relative;
  width: 100%;
  height: 100%;
  user-select: none;
}

.minimap-tick {
  position: absolute;
  inset-inline-start: 0;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.minimap-strip {
  pointer-events: none;
  position: absolute;
  inset-inline-start: 0;
  top: 50%;
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--minimap-marker);
  transform: translateY(-50%);
  width: 8px;
  transition:
    background var(--duration-icon) var(--ease-smooth),
    width var(--duration-icon) var(--ease-smooth);
}

.minimap-strip.strip-active {
  background: var(--ink);
}

.minimap-preview {
  pointer-events: auto;
  position: absolute;
  inset-inline-start: 60px;
  width: 20rem;
  cursor: text;
  user-select: text;
}

.preview-card {
  display: block;
  padding: var(--spacing-sm);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-popover);
  text-align: start;
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
  margin-top: var(--spacing-xxs);
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
