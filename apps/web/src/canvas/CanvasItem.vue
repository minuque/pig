<template>
  <div
    class="canvas-item"
    :data-canvas-item="item.id"
    :data-canvas-name="item.name"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <div class="canvas-chrome">
      <button
        type="button"
        class="canvas-handle"
        data-canvas-handle
        aria-label="移动"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        @keydown="onHandleKey"
      >
        <GripVerticalIcon class="size-3.5" />
        <span class="canvas-hint">方向键移动，Shift 加快</span>
      </button>

      <button
        type="button"
        class="canvas-name"
        data-canvas-name-button
        :aria-describedby="hintId"
        @click="copyName"
      >
        {{ item.name }}
        <span v-if="copied" class="canvas-copied">已复制</span>
      </button>

      <span :id="hintId" class="canvas-hint">复制名称</span>
      <span class="canvas-sr" aria-live="polite">{{ copied ? "已复制" : "" }}</span>
    </div>

    <input
      v-if="copyFailed"
      class="canvas-fallback"
      type="text"
      readonly
      :value="item.name"
      aria-label="名称可选中"
    />

    <div
      class="canvas-preview"
      data-canvas-preview
      :class="{ 'is-fill': item.fill }"
      :style="{ width: `${item.width}px`, height: `${item.height}px` }"
    >
      <component :is="item.component" v-bind="item.props" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, useId } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { GripVerticalIcon } from "@components/icons/index.js"
import type { CanvasItemSpec } from "@/canvas/registry.js"

const props = defineProps<{
  item: CanvasItemSpec
  x: number
  y: number
}>()
const emit = defineEmits<{ move: [delta: { dx: number; dy: number }] }>()
const hintId = useId()
const copied = shallowRef(false)
const copyFailed = shallowRef(false)
const { start } = useTimeoutFn(
  () => {
    copied.value = false
  },
  1200,
  { immediate: false },
)

async function copyName() {
  copyFailed.value = false

  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard")
    await navigator.clipboard.writeText(props.item.name)
    copied.value = true
    start()
  } catch {
    copied.value = false
    copyFailed.value = true
  }
}

function onHandleKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 32 : 8

  if (event.key === "ArrowLeft") emit("move", { dx: -step, dy: 0 })
  else if (event.key === "ArrowRight") emit("move", { dx: step, dy: 0 })
  else if (event.key === "ArrowUp") emit("move", { dx: 0, dy: -step })
  else if (event.key === "ArrowDown") emit("move", { dx: 0, dy: step })
  else return
  event.preventDefault()
  event.stopPropagation()
}
</script>

<style scoped>
.canvas-item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xxs);
}

.canvas-chrome {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  max-width: 280px;
}

.canvas-handle,
.canvas-name {
  cursor: default;
}

.canvas-handle {
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--foreground-muted);
}

.canvas-name {
  min-width: 0;
  color: var(--foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  text-align: start;
}

.canvas-copied {
  margin-inline-start: var(--spacing-xxs);
  color: var(--foreground);
}

.canvas-hint {
  position: absolute;
  z-index: var(--z-menu);
  inset-block-start: 100%;
  inset-inline-start: 0;
  margin-block-start: var(--spacing-xxs);
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--popover);
  color: var(--foreground);
  font-size: var(--text-eyebrow);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}

.canvas-handle:hover .canvas-hint,
.canvas-handle:focus-visible .canvas-hint,
.canvas-name:hover + .canvas-hint,
.canvas-name:focus-visible + .canvas-hint {
  opacity: 1;
}

.canvas-handle:focus-visible,
.canvas-name:focus-visible,
.canvas-fallback:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.canvas-fallback {
  width: 100%;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-size: var(--text-eyebrow);
}

.canvas-preview {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  background: var(--card);
  padding: var(--spacing-xs);
}

.canvas-preview.is-fill {
  align-items: stretch;
}

.canvas-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
