<template>
  <canvas ref="canvas" class="glyph-field" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue"
import { useEventListener, useRafFn, useResizeObserver } from "@vueuse/core"
import { prefersReducedMotion } from "@utils/motion.js"
import { calmAt, windAt, windStrength } from "@features/session-workbench/lib/glyph-wind.js"

interface Touch {
  x: number
  y: number
  start: number
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789+-*/=<>{}[]#%&$@"
const CELL_W = 7
const CELL_H = 14
/** 平时风的亮度上限、整体透明度上限、风场显形用时（秒）。 */
const BASE = 0.26
const CAP = 0.9
const REVEAL = 4
/** 没有操作多久后风停下省电，停下时的淡出用时（秒）。 */
const BUDGET = 30
const SETTLE = 1.5
const FRAME_MS = 1000 / 30
/** 点击涟漪：每秒扩散像素、波带宽度、寿命（秒）。 */
const RIPPLE_SPEED = 520
const RIPPLE_BAND = 52
const RIPPLE_LIFE = 1.6
/** 指针划过：搅亮半径（px）与余温寿命（秒）。 */
const STIR_RADIUS = 48
const STIR_LIFE = 1.2
/** 落在这些元素上的点击不起涟漪：只有点空白背景才算。 */
const INTERACTIVE =
  'button, a, input, textarea, select, [contenteditable="true"], [role="menu"], .composer-stack, .hero-title'
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const host = computed(() => canvas.value?.parentElement ?? null)
const seed = Math.floor(Math.random() * 1e6)
const ripples: Touch[] = []
const stirs: Touch[] = []
let grid = { width: 0, height: 0, cols: 0, rows: 0 }
let seeds = new Uint16Array(0)
let wind = new Float32Array(0)
let shownAt = performance.now()
let activeAt = shownAt
let drawnAt = 0

function resize() {
  const el = canvas.value

  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const cols = Math.ceil(width / CELL_W)
  const rows = Math.ceil(height / CELL_H)

  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  el.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0)
  seeds = Uint16Array.from({ length: cols * rows }, () => Math.floor(Math.random() * 997))
  // 风场按两格一采样：阵风尺度远大于格子，看不出差别，计算量减半
  wind = new Float32Array(Math.ceil(cols / 2) * rows)
  grid = { width, height, cols, rows }
  wake()
}

/** 风的整体增益：开场 4 秒渐显，闲置超时后淡出到 0。 */
function ambientGain(now: number): number {
  const reveal = Math.min(1, (now - shownAt) / 1000 / REVEAL)
  const idle = (now - activeAt) / 1000 - BUDGET
  return reveal * reveal * (idle > 0 ? Math.max(0, 1 - idle / SETTLE) : 1)
}

function rippleAt(x: number, y: number, now: number): number {
  let sum = 0

  for (const ripple of ripples) {
    const age = (now - ripple.start) / 1000
    const k = (Math.hypot(x - ripple.x, y - ripple.y) - age * RIPPLE_SPEED) / RIPPLE_BAND
    const wave = k > 0 ? Math.exp(-k * k * 4) : Math.exp(k * 1.5) * 0.45
    sum += wave * (1 - age / RIPPLE_LIFE) ** 2
  }

  return sum
}

function stirAt(x: number, y: number, now: number): number {
  let sum = 0

  for (const stir of stirs) {
    const fade = 1 - (now - stir.start) / 1000 / STIR_LIFE
    const d2 = (x - stir.x) ** 2 + (y - stir.y) ** 2
    sum += Math.exp(-d2 / (2 * STIR_RADIUS * STIR_RADIUS)) * fade * fade
  }

  return Math.min(1, sum)
}

function prune(list: Touch[], life: number, now: number) {
  while (list.length && (now - list[0]!.start) / 1000 > life) list.shift()
}

function draw(now: number, still = false) {
  const el = canvas.value
  const ctx = el?.getContext("2d")

  if (!el || !ctx) return
  prune(ripples, RIPPLE_LIFE, now)
  prune(stirs, STIR_LIFE, now)
  const gain = still ? 1 : ambientGain(now)

  if (!still && gain === 0 && !ripples.length && !stirs.length) {
    ctx.clearRect(0, 0, grid.width, grid.height)
    loop.pause()
    return
  }

  // 只有风时降到 30 帧；涟漪和搅动要跟手，按显示器帧率走
  if (!still && !ripples.length && !stirs.length && now - drawnAt < FRAME_MS) return
  drawnAt = now

  const { width, height, cols, rows } = grid
  const style = getComputedStyle(el)
  const air = windAt(now / 1000, seed)
  const half = Math.ceil(cols / 2)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < half; c++) {
      const x = (c * 2 + 1) * CELL_W
      const y = (r + 0.5) * CELL_H
      wind[r * half + c] = gain > 0 ? windStrength(x, y, air) * calmAt(x, y, width, height) : 0
    }
  }

  ctx.clearRect(0, 0, width, height)
  ctx.font = `${style.fontSize} ${style.fontFamily}`
  ctx.fillStyle = style.color
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const time = now / 1000

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL_W
      const y = (r + 0.5) * CELL_H
      const breeze = wind[r * half + (c >> 1)]! * BASE * gain
      const stir = stirs.length ? stirAt(x, y, now) * 0.5 : 0
      const hand = ripples.length ? rippleAt(x, y, now) : 0
      const alpha = Math.min(CAP, 1 - (1 - breeze) * (1 - stir) + hand)

      if (alpha < 0.015) continue
      const s = seeds[r * cols + c]!
      // 每格换字的节奏和起点都不同，整片看起来在细碎地闪，不会同步跳
      const glyph = GLYPHS[(s + Math.floor(time * (1.5 + (s % 5) * 0.4))) % GLYPHS.length]!

      ctx.globalAlpha = alpha
      ctx.fillText(glyph, x, y)
    }
  }

  ctx.globalAlpha = 1
}

const loop = useRafFn(({ timestamp }) => draw(timestamp), { immediate: false })

/** 有操作就续上风的时长；系统要求减少动效时只画一帧静止的风。 */
function wake() {
  if (prefersReducedMotion()) {
    draw(performance.now(), true)
    return
  }

  activeAt = performance.now()
  loop.resume()
}

function localPoint(event: PointerEvent) {
  const rect = canvas.value?.getBoundingClientRect()
  return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : undefined
}

useResizeObserver(canvas, resize)

onMounted(() => {
  shownAt = performance.now()
  resize()
})

useEventListener(window, "focus", wake)

useEventListener(window, "keydown", wake, { passive: true })

useEventListener(
  host,
  "pointermove",
  (event: PointerEvent) => {
    const point = localPoint(event)
    const last = stirs[stirs.length - 1]

    if (!point || prefersReducedMotion()) return

    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 12)
      stirs.push({ ...point, start: performance.now() })
    wake()
  },
  { passive: true },
)

useEventListener(host, "pointerdown", (event: PointerEvent) => {
  const point = localPoint(event)
  const target = event.target

  if (!point || event.button !== 0 || prefersReducedMotion()) return

  if (target instanceof Element && target.closest(INTERACTIVE)) return

  if (ripples.length >= 6) ripples.shift()
  ripples.push({ ...point, start: performance.now() })
  wake()
})
</script>

<style scoped>
/* 铺满欢迎页背景，不接点击；字色与字体取 token，canvas 绘制时读回 */
.glyph-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: var(--text-glyph);
}
</style>
