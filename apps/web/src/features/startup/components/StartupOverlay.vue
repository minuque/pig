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
      <p class="startup-slogan" aria-hidden="true">
        <span v-for="(line, lineIndex) in slogan.lines" :key="lineIndex" class="slogan-line"
          ><span>{{ line.plain }}</span
          ><span v-if="line.highlight" class="slogan-highlight">{{ line.highlight }}</span
          ><span v-if="showCursor && slogan.cursorLine === lineIndex" class="slogan-cursor"></span
        ></span>
      </p>
    </div>
  </div>
</template>

<script lang="ts">
export const STARTUP_SLOGAN_LINES = [
  "There are many agent harnesses",
  "but this one is yours",
] as const;

export const STARTUP_SLOGAN = STARTUP_SLOGAN_LINES.join("\n");
export const SLOGAN_HIGHLIGHT = "yours";
export const SLOGAN_CHAR_MS = 24;
export const SLOGAN_END_HOLD_MS = 900;

export interface SloganLineView {
  plain: string;
  highlight: string;
}

/** 按已打出的字符数切两行，yours 开始出现后进 highlight。 */
export function typedSlogan(charCount: number): {
  lines: [SloganLineView, SloganLineView];
  cursorLine: 0 | 1;
} {
  const line1 = STARTUP_SLOGAN_LINES[0];
  const line2 = STARTUP_SLOGAN_LINES[1];
  const n = Math.max(0, Math.min(charCount, STARTUP_SLOGAN.length));
  const empty = { plain: "", highlight: "" } as const;

  if (n <= line1.length) {
    return {
      lines: [{ plain: line1.slice(0, n), highlight: "" }, empty],
      cursorLine: 0,
    };
  }

  const visible2 = line2.slice(0, n - line1.length - 1);
  const hiAt = line2.lastIndexOf(SLOGAN_HIGHLIGHT);
  if (visible2.length <= hiAt) {
    return {
      lines: [
        { plain: line1, highlight: "" },
        { plain: visible2, highlight: "" },
      ],
      cursorLine: 1,
    };
  }

  return {
    lines: [
      { plain: line1, highlight: "" },
      { plain: visible2.slice(0, hiAt), highlight: visible2.slice(hiAt) },
    ],
    cursorLine: 1,
  };
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";
import { createPiLogoPlayer, type PiLogoPlayer } from "@features/startup/lib/pi-logo-animation.js";

const emit = defineEmits<{ reveal: []; finished: [] }>();

const host = useTemplateRef<HTMLButtonElement>("host");
const wrap = useTemplateRef<HTMLDivElement>("wrap");
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const animationComplete = shallowRef(false);
const leaving = shallowRef(false);
const typedChars = shallowRef(0);
const sloganTyping = shallowRef(false);

const slogan = computed(() => typedSlogan(typedChars.value));
const showCursor = computed(() => sloganTyping.value);

const LEAVE_MS = 440;
let player: PiLogoPlayer | undefined;
let leaveTimer = 0;
let reducedMotion = false;
let finished = false;
let resizeObserver: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;
let motionQuery: MediaQueryList | undefined;
let sloganAbort: AbortController | undefined;
let sloganPromise: Promise<void> = Promise.resolve();

function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const timer = window.setTimeout(() => resolve(!signal.aborted), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve(false);
      },
      { once: true },
    );
  });
}

async function runSlogan(signal: AbortSignal): Promise<void> {
  sloganTyping.value = true;
  typedChars.value = 0;
  for (let i = 1; i <= STARTUP_SLOGAN.length; i += 1) {
    if (signal.aborted) return;
    typedChars.value = i;
    if (!(await sleep(SLOGAN_CHAR_MS, signal))) return;
  }
  if (signal.aborted) return;
  await sleep(SLOGAN_END_HOLD_MS, signal);
  if (!signal.aborted) sloganTyping.value = false;
}

function startSlogan() {
  sloganAbort?.abort();
  sloganAbort = new AbortController();
  sloganPromise = runSlogan(sloganAbort.signal);
}

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
  sloganAbort?.abort();
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
  if (target && board) {
    player = createPiLogoPlayer({
      canvas: target,
      wrap: board,
      themeColor,
      onNearEnd: startSlogan,
    });
  }

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

  void player?.play().then(async (played) => {
    if (!played) return;
    await sloganPromise;
    completeAnimation();
  });
});

onBeforeUnmount(() => {
  sloganAbort?.abort();
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
  gap: var(--spacing-md);
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
  width: clamp(96px, 15vw, 128px);
  min-height: 0;
  aspect-ratio: 8 / 9;
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
  height: 100%;
  overflow: visible;
}
.logo-wrap {
  position: absolute;
  inset: 0;
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
.startup-slogan {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  min-height: calc(2em * var(--text-caption--line-height));
  margin: 0;
  color: var(--ink-muted);
  font-size: calc(var(--text-caption) + 2px);
  line-height: var(--text-caption--line-height);
  text-align: center;
  pointer-events: none;
}
.slogan-line {
  display: block;
  min-height: calc(1em * var(--text-caption--line-height));
  white-space: nowrap;
}
.slogan-highlight {
  color: var(--primary);
  font-style: italic;
  font-weight: var(--font-weight-bold);
}
.slogan-cursor {
  display: inline-block;
  width: 1.5px;
  height: 0.85em;
  margin-left: 1px;
  background: currentColor;
  vertical-align: -0.08em;
  animation: slogan-caret 1.05s steps(1, end) infinite;
}
.slogan-line:has(.slogan-highlight) .slogan-cursor {
  background: var(--primary);
}
@keyframes slogan-caret {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
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
  .slogan-cursor {
    animation: none;
  }
}
</style>
