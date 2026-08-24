<template>
  <div
    class="timeline-minimap"
    :class="{ persistent: hasPersistentGutter }"
    data-testid="timeline-minimap"
    :data-persistent-gutter="hasPersistentGutter ? 'true' : 'false'"
  >
    <div class="minimap-stage">
      <button
        class="minimap-rail"
        :class="{ interactive: hitStripWidth > 0 }"
        type="button"
        :aria-label="`跳转到：${activeItem?.userText ?? '用户句'}`"
        :style="{
          height: resolveMinimapHeightStyle(items.length),
          width: railWidth,
        }"
        @blur="activeIndex = null"
        @click="onRailClick"
        @focus="onRailFocus"
        @keydown="onRailKeydown"
        @mouseleave="activeIndex = null"
        @mousemove="onRailMove"
        @mousedown="onRailMouseDown"
      >
        <span class="minimap-spine" aria-hidden="true"></span>
        <span
          v-for="(item, index) in items"
          :key="item.id"
          class="minimap-strip"
          :class="stripClass(index)"
          :data-in-view="inViewIds.includes(item.id) ? 'true' : 'false'"
          :style="{ top: `${resolveMinimapTopPercent(index, items.length)}%` }"
          aria-hidden="true"
        ></span>
        <span
          v-if="activeItem"
          class="minimap-preview"
          data-minimap-preview
          :style="{
            top: `${resolveMinimapTopPercent(resolvedActiveIndex ?? 0, items.length)}%`,
            transform: `translateY(${previewTranslate})`,
          }"
          @mousemove.stop
        >
          <span class="preview-card">
            <span class="preview-user">{{ activeItem.userText ?? "用户句" }}</span>
            <span v-if="activeItem.assistantText" class="preview-assistant">{{
              activeItem.assistantText
            }}</span>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { TranscriptMinimapItem } from "@features/session-workbench/lib/transcript-minimap.js";
import {
  resolveMinimapHeightStyle,
  resolveMinimapIndexFromPointer,
  resolveMinimapInteractiveWidth,
  resolveMinimapTopPercent,
} from "@features/session-workbench/lib/transcript-minimap.js";

const props = defineProps<{
  items: readonly TranscriptMinimapItem[];
  inViewIds: readonly string[];
  hasPersistentGutter: boolean;
  hitStripWidth: number;
}>();

const emit = defineEmits<{
  select: [item: TranscriptMinimapItem];
}>();

const activeIndex = shallowRef<number | null>(null);

const resolvedActiveIndex = computed(() => {
  const index = activeIndex.value;
  return index !== null && index < props.items.length ? index : null;
});
const activeItem = computed(() => {
  const index = resolvedActiveIndex.value;
  return index === null ? null : (props.items[index] ?? null);
});
const previewTranslate = computed(() => {
  const index = resolvedActiveIndex.value;
  if (index === null) return "-50%";
  if (index === 0) return "0%";
  if (index === props.items.length - 1) return "-100%";
  return "-50%";
});
const railWidth = computed(() =>
  resolveMinimapInteractiveWidth(props.hitStripWidth, activeItem.value !== null),
);

function stripClass(index: number): string {
  const active = resolvedActiveIndex.value;
  if (active === null) return "strip-far";
  const distance = Math.abs(index - active);
  if (distance === 0) return "strip-active";
  if (distance === 1) return "strip-near";
  if (distance === 2) return "strip-mid";
  return "strip-far";
}

function indexFromEvent(event: MouseEvent): number | null {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return resolveMinimapIndexFromPointer({
    itemCount: props.items.length,
    railTop: rect.top,
    railHeight: rect.height,
    pointerY: event.clientY,
  });
}

function previewTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-minimap-preview]") !== null;
}

function onRailMove(event: MouseEvent) {
  activeIndex.value = indexFromEvent(event);
}

function onRailFocus() {
  if (activeIndex.value === null) activeIndex.value = 0;
}

function onRailClick(event: MouseEvent) {
  if (previewTarget(event.target)) return;
  const index = indexFromEvent(event);
  const item = index === null ? null : (props.items[index] ?? null);
  if (item) emit("select", item);
  (event.currentTarget as HTMLButtonElement).blur();
}

function onRailMouseDown(event: MouseEvent) {
  if (previewTarget(event.target)) return;
  event.preventDefault();
}

function onRailKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveActive(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(-1);
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    activeIndex.value = 0;
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    activeIndex.value = Math.max(0, props.items.length - 1);
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const item = activeItem.value;
    if (item) emit("select", item);
  }
}

function moveActive(delta: number) {
  const base = activeIndex.value ?? 0;
  activeIndex.value = Math.max(0, Math.min(props.items.length - 1, base + delta));
}
</script>

<style scoped>
.timeline-minimap {
  pointer-events: none;
  position: absolute;
  z-index: 3;
  inset: 0 auto var(--chat-input-space, 168px) 0;
  display: none;
  width: 4.5rem;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-smooth);
}
.timeline-minimap.persistent,
.timeline-minimap:hover,
.timeline-minimap:focus-within {
  opacity: 1;
}
.minimap-stage {
  position: relative;
  width: 100%;
  height: 100%;
  user-select: none;
}
.minimap-rail {
  position: absolute;
  top: 50%;
  left: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translateY(-50%);
  cursor: pointer;
}
.minimap-rail.interactive {
  pointer-events: auto;
}
.minimap-rail:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: 2px;
}
.minimap-spine {
  position: absolute;
  top: 0;
  left: 12px;
  width: 1px;
  height: 100%;
  background: color-mix(in srgb, var(--ink) 15%, transparent);
}
.minimap-strip {
  pointer-events: none;
  position: absolute;
  left: 0;
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
.minimap-strip.strip-mid {
  width: 10px;
}
.minimap-strip.strip-near {
  width: 16px;
}
.minimap-strip.strip-active {
  width: 24px;
  background: color-mix(in srgb, var(--ink-muted) 75%, transparent);
}
.minimap-preview {
  pointer-events: auto;
  position: absolute;
  left: 32px;
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
  .timeline-minimap,
  .minimap-strip {
    transition: none;
  }
}
</style>
