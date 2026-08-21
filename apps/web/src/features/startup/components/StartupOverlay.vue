<template>
  <div class="startup-wait" :class="{ leaving }" @click="skipAnimation">
    <div class="drag-strip" aria-hidden="true"></div>
    <div class="startup-content">
      <button
        ref="host"
        class="logo-button"
        type="button"
        :disabled="animationComplete"
        aria-label="跳过 Pi 启动动画"
        @click.stop="skipAnimation"
      >
        <div class="logo-stage">
          <div ref="wrap" class="logo-wrap">
            <canvas ref="canvas" class="logo-canvas" aria-hidden="true"></canvas>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";
import { createPiLogoPlayer, type PiLogoPlayer } from "@features/startup/lib/pi-logo-animation.js";

const emit = defineEmits<{ reveal: []; finished: [] }>();

const host = useTemplateRef<HTMLButtonElement>("host");
const wrap = useTemplateRef<HTMLDivElement>("wrap");
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const animationComplete = shallowRef(false);
const leaving = shallowRef(false);

const LEAVE_MS = 440;
let player: PiLogoPlayer | undefined;
let leaveTimer = 0;
let reducedMotion = false;
let finished = false;
let resizeObserver: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;
let motionQuery: MediaQueryList | undefined;

function themeColor(): string {
  const ink = getComputedStyle(host.value ?? document.documentElement)
    .getPropertyValue("--ink")
    .trim();
  return ink || "#0f1115";
}

function finish() {
  if (finished) return;
  finished = true;
  emit("finished");
}

function beginLeave() {
  if (leaving.value || finished || !animationComplete.value) return;
  emit("reveal");
  if (reducedMotion || document.hidden) {
    finish();
    return;
  }
  leaving.value = true;
  leaveTimer = window.setTimeout(finish, LEAVE_MS);
}

function completeAnimation() {
  player?.cancel();
  animationComplete.value = true;
  beginLeave();
}

function skipAnimation() {
  if (!animationComplete.value) completeAnimation();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  skipAnimation();
}

function onVisibilityChange() {
  if (document.hidden) completeAnimation();
}

function onMotionChange() {
  reducedMotion = motionQuery?.matches ?? false;
  if (reducedMotion) completeAnimation();
}

onMounted(() => {
  const target = canvas.value;
  const board = wrap.value;
  if (target && board) player = createPiLogoPlayer({ canvas: target, wrap: board, themeColor });

  resizeObserver = new ResizeObserver(() => player?.resize());
  if (board) resizeObserver.observe(board);
  themeObserver = new MutationObserver(() => {
    if (animationComplete.value) player?.showStatic();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("keydown", onKeydown);

  reducedMotion = motionQuery.matches;
  if (reducedMotion || document.hidden) {
    completeAnimation();
    return;
  }

  void player?.play().then((played) => {
    if (played) completeAnimation();
  });
});

onBeforeUnmount(() => {
  player?.cancel();
  window.clearTimeout(leaveTimer);
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  motionQuery?.removeEventListener("change", onMotionChange);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("keydown", onKeydown);
});
</script>

<style scoped>
.startup-wait {
  position: fixed;
  z-index: var(--z-modal);
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  opacity: 1;
  -webkit-app-region: no-drag;
}
.startup-wait.leaving {
  pointer-events: none;
  opacity: 0;
  transition: opacity 420ms var(--ease-smooth);
}
.drag-strip {
  position: absolute;
  z-index: 1;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
}
.startup-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 1;
  transform: translateY(0) scale(1);
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    transform var(--duration-slow) var(--ease-out);
}
.startup-wait.leaving .startup-content {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.logo-button {
  width: clamp(112px, 18vw, 168px);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  -webkit-app-region: no-drag;
}
.logo-button:disabled {
  cursor: default;
  opacity: 1;
}
.logo-button:not(:disabled):active {
  transform: none;
}
.logo-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: visible;
}
.logo-wrap {
  position: absolute;
  top: calc(100% * -3 / 4);
  left: calc(100% * -2 / 4);
  width: calc(100% * 8 / 4);
  height: calc(100% * 9 / 4);
  pointer-events: none;
}
.logo-canvas {
  position: absolute;
  bottom: 0;
  left: 0;
  display: block;
  image-rendering: pixelated;
  pointer-events: none;
}
@media (prefers-reduced-transparency: reduce) {
  .startup-wait {
    background: var(--surface);
  }
}
@media (prefers-reduced-motion: reduce) {
  .startup-wait.leaving,
  .startup-content {
    transition: none;
  }
}
</style>
