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
      <p
        class="startup-slogan"
        :style="{ '--slogan-fade': `${SLOGAN_FADE_MS}ms` }"
        aria-hidden="true"
      >
        <span v-for="lineIndex in [0, 1]" :key="lineIndex" class="slogan-line"
          ><span
            v-for="glyph in glyphsByLine[lineIndex]"
            :key="glyph.id"
            class="slogan-glyph"
            :class="{ 'slogan-highlight': glyph.highlight }"
            :style="{ animationDelay: `${glyph.delayMs}ms` }"
            >{{ glyph.text }}</span
          ><span
            v-if="showCursor && cursorLine === lineIndex"
            class="slogan-cursor"
            :class="{ 'slogan-cursor-accent': cursorAccent }"
          ></span
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
export const SLOGAN_CHAR_MS = 28;
export const SLOGAN_SPACE_EXTRA_MS = 16;
export const SLOGAN_NEWLINE_MS = 90;
export const SLOGAN_YOURS_MS = 44;
export const SLOGAN_FADE_MS = 100;
export const SLOGAN_END_HOLD_MS = 900;

export interface SloganGlyph {
  id: number;
  text: string;
  line: 0 | 1;
  highlight: boolean;
  delayMs: number;
}

function stepAfter(ch: string, highlight: boolean): number {
  if (highlight) return SLOGAN_YOURS_MS;
  if (ch === " ") return SLOGAN_CHAR_MS + SLOGAN_SPACE_EXTRA_MS;
  return SLOGAN_CHAR_MS;
}

/** 可见字形的错开时间表：空格/换行略停，yours 稍慢。 */
export function sloganGlyphs(): SloganGlyph[] {
  const glyphs: SloganGlyph[] = [];
  const yoursAt = STARTUP_SLOGAN.lastIndexOf(SLOGAN_HIGHLIGHT);
  let delayMs = 0;
  let line: 0 | 1 = 0;
  let id = 0;

  for (let i = 0; i < STARTUP_SLOGAN.length; i += 1) {
    const text = STARTUP_SLOGAN[i]!;
    if (text === "\n") {
      delayMs += SLOGAN_NEWLINE_MS;
      line = 1;
      continue;
    }
    const highlight = i >= yoursAt;
    glyphs.push({ id, text, line, highlight, delayMs });
    id += 1;
    delayMs += stepAfter(text, highlight);
  }
  return glyphs;
}

export const SLOGAN_GLYPHS = sloganGlyphs();

export function sloganPlayMs(glyphs: readonly SloganGlyph[] = SLOGAN_GLYPHS): number {
  const last = glyphs[glyphs.length - 1];
  return (last?.delayMs ?? 0) + SLOGAN_FADE_MS + SLOGAN_END_HOLD_MS;
}

/** 换行开始即把光标移到第二行。 */
export function sloganCursorLine(
  elapsedMs: number,
  glyphs: readonly SloganGlyph[] = SLOGAN_GLYPHS,
): 0 | 1 {
  const firstLine2 = glyphs.find((glyph) => glyph.line === 1);
  if (firstLine2 && elapsedMs >= firstLine2.delayMs - SLOGAN_NEWLINE_MS) return 1;
  return 0;
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
const sloganTyping = shallowRef(false);
const elapsedMs = shallowRef(0);
const visibleGlyphs = shallowRef<readonly SloganGlyph[]>([]);

const glyphsByLine = computed(() => {
  const lines: [SloganGlyph[], SloganGlyph[]] = [[], []];
  for (const glyph of visibleGlyphs.value) lines[glyph.line].push(glyph);
  return lines;
});
const cursorLine = computed(() => sloganCursorLine(elapsedMs.value));
const showCursor = computed(() => sloganTyping.value);
const cursorAccent = computed(() => {
  const yours = SLOGAN_GLYPHS.find((glyph) => glyph.highlight);
  return yours !== undefined && elapsedMs.value >= yours.delayMs;
});

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
let sloganRaf = 0;

function stopSloganRaf() {
  if (sloganRaf === 0) return;
  window.cancelAnimationFrame(sloganRaf);
  sloganRaf = 0;
}

async function runSlogan(signal: AbortSignal): Promise<void> {
  visibleGlyphs.value = SLOGAN_GLYPHS;
  sloganTyping.value = true;
  elapsedMs.value = 0;
  const startedAt = performance.now();
  const totalMs = sloganPlayMs();

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (signal.aborted) {
        sloganRaf = 0;
        resolve();
        return;
      }
      elapsedMs.value = now - startedAt;
      if (elapsedMs.value >= totalMs) {
        sloganRaf = 0;
        resolve();
        return;
      }
      sloganRaf = window.requestAnimationFrame(tick);
    };
    sloganRaf = window.requestAnimationFrame(tick);
  });

  if (!signal.aborted) sloganTyping.value = false;
}

function startSlogan() {
  sloganAbort?.abort();
  stopSloganRaf();
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
  stopSloganRaf();
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
  stopSloganRaf();
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
  color: var(--ink);
  font-size: var(--text-title);
  line-height: var(--text-caption--line-height);
  text-align: center;
  pointer-events: none;
}
.slogan-line {
  display: block;
  min-height: calc(1em * var(--text-caption--line-height));
  white-space: nowrap;
}
.slogan-glyph {
  opacity: 0;
  animation: slogan-ink var(--slogan-fade) var(--ease-out) both;
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
.slogan-cursor-accent {
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
@keyframes slogan-ink {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
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
  .slogan-glyph {
    animation: none;
    opacity: 1;
  }
}
</style>
