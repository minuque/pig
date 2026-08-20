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
        <canvas ref="canvas" class="logo-canvas" aria-hidden="true"></canvas>
      </button>
      <p
        class="startup-status"
        :class="{ visible: animationComplete && !ready }"
        role="status"
        aria-live="polite"
      >
        {{ animationComplete && !ready ? phaseLabel : "" }}
      </p>
    </div>
  </div>
</template>

<script lang="ts">
export type PiLogoColor = "cyan" | "red" | "green" | "orange" | "theme";
export type PiLogoPiece = "left" | "top" | "right";

export interface PiLogoFrame {
  phase: 0 | 1 | 2 | 3 | 4 | 5;
  durationMs: number;
  active?: PiLogoPiece;
  activeX?: number;
  activeY?: number;
  flash?: boolean;
  theme?: boolean;
}

export interface PiLogoCell {
  x: number;
  y: number;
  color: PiLogoColor;
}

const PIECES = {
  left: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 0],
  ],
  top: [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  right: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
} as const;

const FINAL_PI = new Set(["3,2", "3,3", "3,4", "4,2", "4,4", "5,2", "5,3", "5,5", "6,2", "6,5"]);
const CYAN_PHASE_4 = new Set(["2,2", "2,3", "2,4", "3,4"]);
const RED_PHASE_4 = new Set(["3,2", "4,2", "4,3", "5,2"]);
const GREEN_PHASE_3 = new Set(["4,5", "5,5", "6,5", "6,6"]);
const GREEN_PHASE_4 = new Set(["4,5", "5,5"]);
const CYAN_PHASE_5 = new Set(["3,2", "3,3", "3,4", "4,4"]);
const RED_PHASE_5 = new Set(["4,2", "5,2", "5,3", "6,2"]);
const GREEN_PHASE_5 = new Set(["5,5", "6,5"]);

function fallingFrames(
  phase: PiLogoFrame["phase"],
  active: PiLogoPiece,
  activeX: number,
  positions: readonly number[],
): PiLogoFrame[] {
  return positions.map((activeY) => ({ phase, active, activeX, activeY, durationMs: 75 }));
}

/** 当前 install.ps1 的 Show-PiLogoAnimation 时间线快照。 */
export const PI_LOGO_FRAMES: readonly PiLogoFrame[] = [
  ...fallingFrames(0, "left", 2, [0, 1, 2, 3]),
  ...fallingFrames(1, "top", 2, [0, 1, 2]),
  ...fallingFrames(2, "right", 5, [0, 1, 2, 3, 4]),
  { phase: 3, durationMs: 250 },
  { phase: 3, durationMs: 80, flash: true },
  { phase: 3, durationMs: 80 },
  { phase: 3, durationMs: 80, flash: true },
  { phase: 4, durationMs: 100 },
  { phase: 5, durationMs: 450 },
  { phase: 5, durationMs: 120, theme: true },
  { phase: 5, durationMs: 120 },
  { phase: 5, durationMs: 450, theme: true },
];

export const PI_LOGO_DURATION_MS = PI_LOGO_FRAMES.reduce(
  (duration, frame) => duration + frame.durationMs,
  0,
);

const PIECE_COLORS: Record<PiLogoPiece, PiLogoColor> = {
  left: "red",
  top: "cyan",
  right: "green",
};

function colorAt(frame: PiLogoFrame, y: number, x: number): PiLogoColor | undefined {
  const key = `${y},${x}`;
  if (frame.theme) return FINAL_PI.has(key) ? "theme" : undefined;
  if (frame.flash && y === 6 && x >= 1 && x <= 6) return "orange";

  if (frame.phase === 4) {
    if (CYAN_PHASE_4.has(key)) return "cyan";
    if (RED_PHASE_4.has(key)) return "red";
    if (GREEN_PHASE_4.has(key)) return "green";
    return undefined;
  }
  if (frame.phase >= 5) {
    if (CYAN_PHASE_5.has(key)) return "cyan";
    if (RED_PHASE_5.has(key)) return "red";
    if (GREEN_PHASE_5.has(key)) return "green";
    return undefined;
  }
  if (y === 6 && x >= 1 && x <= 4) return "orange";
  if (frame.phase >= 2 && CYAN_PHASE_4.has(key)) return "cyan";
  if (frame.phase >= 1 && RED_PHASE_4.has(key)) return "red";
  if (frame.phase >= 3 && GREEN_PHASE_3.has(key)) return "green";
  return undefined;
}

export function interpolatedActiveY(frameIndex: number, progress: number): number | undefined {
  const frame = PI_LOGO_FRAMES[frameIndex];
  if (!frame?.active || frame.activeY === undefined) return undefined;
  const next = PI_LOGO_FRAMES[frameIndex + 1];
  if (next?.active !== frame.active || next.activeY === undefined) return frame.activeY;
  const t = Math.max(0, Math.min(1, progress));
  return frame.activeY + (next.activeY - frame.activeY) * t;
}

export function cellsForPiLogoFrame(frame: PiLogoFrame, activeY = frame.activeY): PiLogoCell[] {
  const cells: PiLogoCell[] = [];
  for (let y = 0; y <= 8; y += 1) {
    for (let x = 1; x <= 8; x += 1) {
      const color = colorAt(frame, y, x);
      if (color) cells.push({ x, y, color });
    }
  }
  if (frame.active && frame.activeX !== undefined && activeY !== undefined) {
    for (const [pieceY, pieceX] of PIECES[frame.active]) {
      cells.push({
        x: frame.activeX + pieceX,
        y: activeY + pieceY,
        color: PIECE_COLORS[frame.active],
      });
    }
  }
  return cells;
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import type { StartupPhase } from "./types.js";

const props = defineProps<{
  ready: boolean;
  phase: StartupPhase;
}>();
const emit = defineEmits<{ reveal: []; finished: [] }>();

const host = useTemplateRef<HTMLButtonElement>("host");
const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
const animationComplete = shallowRef(false);
const leaving = shallowRef(false);
const currentFrame = shallowRef<PiLogoFrame>(PI_LOGO_FRAMES[0]!);
const phaseLabel = computed(() => {
  switch (props.phase) {
    case "authorizing":
      return "正在验证启动凭证";
    case "connecting":
      return "正在连接 Pi";
    case "preparing":
      return "正在准备工作台";
  }
  return "";
});

const PALETTE: Record<Exclude<PiLogoColor, "theme">, string> = {
  cyan: "#4B607C",
  red: "#8F4632",
  green: "#A3A473",
  orange: "#D4904E",
};
const LEAVE_MS = 200;
let animationRequest = 0;
let frameIndex = 0;
let frameStartedAt = -1;
let currentActiveY = currentFrame.value.activeY;
let leaveTimer = 0;
let reducedMotion = false;
let finished = false;
let resizeObserver: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;
let motionQuery: MediaQueryList | undefined;

function paint() {
  const target = canvas.value;
  const container = host.value;
  if (!target || !container) return;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (target.width !== width || target.height !== height) {
    target.width = width;
    target.height = height;
  }
  const context = target.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const themeColor = getComputedStyle(container).getPropertyValue("--ink").trim() || "#0f1115";
  for (const cell of cellsForPiLogoFrame(currentFrame.value, currentActiveY)) {
    const left = Math.round(((cell.x - 1) * width) / 8);
    const right = Math.round((cell.x * width) / 8);
    const top = Math.round((cell.y * height) / 9);
    const bottom = Math.round(((cell.y + 1) * height) / 9);
    context.fillStyle = cell.color === "theme" ? themeColor : PALETTE[cell.color];
    context.fillRect(left, top, right - left, bottom - top);
  }
}

function finish() {
  if (finished) return;
  finished = true;
  emit("finished");
}

function beginLeave() {
  if (leaving.value || finished || !props.ready || !animationComplete.value) return;
  emit("reveal");
  if (reducedMotion || document.hidden) {
    finish();
    return;
  }
  leaving.value = true;
  leaveTimer = window.setTimeout(finish, LEAVE_MS);
}

function completeAnimation() {
  cancelAnimationFrame(animationRequest);
  currentFrame.value = PI_LOGO_FRAMES.at(-1)!;
  currentActiveY = undefined;
  animationComplete.value = true;
  paint();
  beginLeave();
}

function animateLogo(now: number) {
  if (frameStartedAt < 0) frameStartedAt = now;
  let frame = PI_LOGO_FRAMES[frameIndex];
  while (frame && now - frameStartedAt >= frame.durationMs) {
    frameStartedAt += frame.durationMs;
    frameIndex += 1;
    frame = PI_LOGO_FRAMES[frameIndex];
  }
  if (!frame) {
    completeAnimation();
    return;
  }
  currentFrame.value = frame;
  currentActiveY = interpolatedActiveY(frameIndex, (now - frameStartedAt) / frame.durationMs);
  paint();
  animationRequest = requestAnimationFrame(animateLogo);
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

watch(
  () => props.ready,
  () => beginLeave(),
);

onMounted(() => {
  resizeObserver = new ResizeObserver(paint);
  if (host.value) resizeObserver.observe(host.value);
  themeObserver = new MutationObserver(paint);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("keydown", onKeydown);

  reducedMotion = motionQuery.matches;
  if (reducedMotion || document.hidden) completeAnimation();
  else {
    paint();
    animationRequest = requestAnimationFrame(animateLogo);
  }
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animationRequest);
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
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--ink);
  backdrop-filter: blur(28px) saturate(1.4);
  -webkit-backdrop-filter: blur(28px) saturate(1.4);
  cursor: pointer;
  opacity: 1;
  -webkit-app-region: no-drag;
}
.startup-wait.leaving {
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-smooth);
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
  gap: var(--spacing-sm);
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
.logo-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.startup-status {
  min-height: 1rem;
  margin: 0;
  visibility: hidden;
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  line-height: var(--text-caption-mono--line-height);
  letter-spacing: var(--tracking-caption-mono);
  opacity: 0;
}
.startup-status.visible {
  visibility: visible;
  opacity: 1;
}
:global(html[data-pig-desktop-platform="darwin"] .startup-underlay),
:global(html[data-pig-desktop-platform="win32"] .startup-underlay) {
  opacity: 0;
}
:global(html[data-pig-desktop-platform="darwin"] .startup-underlay-transition),
:global(html[data-pig-desktop-platform="win32"] .startup-underlay-transition) {
  transition: opacity var(--duration-normal) var(--ease-smooth);
}
:global(html[data-pig-desktop-platform="darwin"]) .startup-wait,
:global(html[data-pig-desktop-platform="win32"]) .startup-wait {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
@media (prefers-reduced-transparency: reduce) {
  .startup-wait {
    background: var(--surface);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .startup-wait.leaving,
  :global(html[data-pig-desktop-platform] .startup-underlay-transition) {
    transition: none;
  }
}
</style>
