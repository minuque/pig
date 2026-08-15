<template>
  <button
    ref="host"
    class="mascot"
    type="button"
    :aria-label="label"
    :title="label"
    @pointermove="onPointer"
    @pointerleave="resetGaze"
    @click="runtime.blink()"
  >
    <canvas ref="canvas" class="mascot-canvas" aria-hidden="true"></canvas>
  </button>
</template>

<script setup lang="ts">
import { computed, ref, toRef, useTemplateRef } from "vue";
import { clamp } from "./expressions.js";
import { useMascotRuntime } from "./hooks/use-mascot-runtime.js";
import type { Gaze, MascotState } from "./types.js";

const props = withDefaults(
  defineProps<{
    state?: MascotState;
    size?: number;
    label?: string;
    autoBlink?: boolean;
    autoExpression?: boolean;
    followPointer?: boolean;
  }>(),
  {
    state: "idle",
    size: 88,
    label: "pig",
    autoBlink: true,
    autoExpression: true,
    followPointer: true,
  },
);

const host = useTemplateRef<HTMLButtonElement>("host");
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const gaze = ref<Gaze>({ x: 0, y: 0 });
const sizePx = computed(() => `${props.size}px`);

const runtime = useMascotRuntime({
  canvas,
  host,
  state: toRef(props, "state"),
  gaze,
  size: toRef(props, "size"),
  autoBlink: toRef(props, "autoBlink"),
  autoExpression: toRef(props, "autoExpression"),
});

function onPointer(event: PointerEvent) {
  if (!props.followPointer) return;
  const el = host.value;
  if (!el) return;
  const box = el.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return;
  gaze.value = {
    x: clamp((event.clientX - box.left) / box.width, 0, 1) * 2 - 1,
    y: clamp((event.clientY - box.top) / box.height, 0, 1) * 2 - 1,
  };
}

function resetGaze() {
  gaze.value = { x: 0, y: 0 };
}
</script>

<style scoped>
.mascot {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: v-bind(sizePx);
  height: v-bind(sizePx);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  color: inherit;
  cursor: pointer;
  animation: mascot-breath 3.4s var(--ease-in-out) infinite;
}
.mascot-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
@media (prefers-reduced-motion: reduce) {
  .mascot {
    animation: none;
  }
}
@keyframes mascot-breath {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}
</style>
