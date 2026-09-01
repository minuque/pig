<template>
  <div
    class="width-handle"
    :data-side="side"
    :data-dragging="dragging || undefined"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
    @keydown.left.prevent="emit('nudge', -16)"
    @keydown.right.prevent="emit('nudge', 16)"
  ></div>
</template>

<script setup lang="ts">
import { shallowRef } from "vue"

const props = defineProps<{
  side: "left" | "right"
  measure: () => number
}>()

const emit = defineEmits<{
  start: []
  drag: [width: number]
  commit: [width: number]
  end: []
  nudge: [delta: number]
}>()

const dragging = shallowRef(false)
let originX = 0
let latestX = 0
let baseWidth = 0
let frame = 0

function outwardWidth(): number {
  const dx = latestX - originX
  const outward = props.side === "right" ? dx : -dx
  return baseWidth + outward * 2
}

function cancelFrame() {
  if (!frame) return
  cancelAnimationFrame(frame)
  frame = 0
}

function onPointerDown(event: PointerEvent) {
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) return
  event.preventDefault()
  handle.setPointerCapture(event.pointerId)
  originX = event.clientX
  latestX = event.clientX
  baseWidth = props.measure()
  dragging.value = true
  emit("start")
}

function onPointerMove(event: PointerEvent) {
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) return
  const box = handle.getBoundingClientRect()
  handle.style.setProperty("--width-handle-pointer-y", `${event.clientY - box.top}px`)
  if (!handle.hasPointerCapture(event.pointerId)) return
  latestX = event.clientX
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    emit("drag", outwardWidth())
  })
}

function onPointerUp(event: PointerEvent) {
  const handle = event.currentTarget
  if (!(handle instanceof HTMLElement)) return
  if (!handle.hasPointerCapture(event.pointerId)) return
  handle.releasePointerCapture(event.pointerId)
  cancelFrame()
  latestX = event.clientX
  if (latestX !== originX) emit("commit", outwardWidth())
  dragging.value = false
  emit("end")
}

function onPointerCancel() {
  cancelFrame()
  dragging.value = false
  emit("end")
}
</script>

<style scoped>
.width-handle {
  position: absolute;
  inset-block: 0;
  z-index: var(--z-resizer);
  width: min(var(--size-control), calc((100% - var(--size-content)) / 2 - 48px));
  cursor: col-resize;
  touch-action: none;
}
.width-handle[data-side="left"] {
  right: calc(50% + var(--size-content) / 2 + var(--spacing-lg));
}
.width-handle[data-side="right"] {
  left: calc(50% + var(--size-content) / 2 + var(--spacing-lg));
}
.width-handle::after {
  pointer-events: none;
  position: absolute;
  inset-block: 0;
  width: 3px;
  border-radius: var(--radius-2xs);
  background: linear-gradient(
    to bottom,
    transparent calc(var(--width-handle-pointer-y, 50%) - 52px),
    var(--hairline) calc(var(--width-handle-pointer-y, 50%) - 12px),
    var(--hairline) calc(var(--width-handle-pointer-y, 50%) + 12px),
    transparent calc(var(--width-handle-pointer-y, 50%) + 52px)
  );
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
  content: "";
}
.width-handle[data-side="left"]::after {
  right: var(--spacing-md);
}
.width-handle[data-side="right"]::after {
  left: var(--spacing-md);
}
.width-handle:hover::after,
.width-handle[data-dragging]::after {
  opacity: 1;
}
@media (max-width: 900px) {
  .width-handle {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .width-handle::after {
    transition: none;
  }
}
</style>
