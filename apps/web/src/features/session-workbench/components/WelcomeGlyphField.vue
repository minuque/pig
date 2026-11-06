<template>
  <canvas ref="canvas" class="glyph-field" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, useTemplateRef } from "vue"
import { useEventListener, useRafFn, useResizeObserver } from "@vueuse/core"
import { prefersReducedMotion } from "@utils/motion.js"

interface Ripple {
  x: number
  y: number
  start: number
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789+-*/=<>{}[]#%&$@"
const CELL_W = 7
const CELL_H = 14
/** 波前每秒扩散的像素、波带宽度、单次涟漪寿命（秒）。 */
const SPEED = 520
const BAND = 52
const LIFE = 1.6
const MAX_RIPPLES = 6
/** 落在这些元素上的点击不起涟漪：只有点空白背景才算。 */
const INTERACTIVE =
  'button, a, input, textarea, select, [contenteditable="true"], [role="menu"], .composer-stack, .hero-title'
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
const host = computed(() => canvas.value?.parentElement ?? null)
const ripples: Ripple[] = []
const size = shallowRef({ width: 0, height: 0, cols: 0, rows: 0 })
let seeds = new Uint16Array(0)
let energy = new Float32Array(0)

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
  seeds = Uint16Array.from({ length: cols * rows }, () => Math.floor(Math.random() * GLYPHS.length))
  energy = new Float32Array(cols * rows)
  size.value = { width, height, cols, rows }
}

/** 把每条涟漪的波带能量叠到格子上：前沿亮，波后留一截余辉。 */
function accumulate(now: number, touched: number[]) {
  const { cols, rows } = size.value

  for (const ripple of ripples) {
    const age = (now - ripple.start) / 1000
    const radius = age * SPEED
    const fade = (1 - age / LIFE) ** 2
    const reach = radius + BAND
    const c0 = Math.max(0, Math.floor((ripple.x - reach) / CELL_W))
    const c1 = Math.min(cols - 1, Math.ceil((ripple.x + reach) / CELL_W))
    const r0 = Math.max(0, Math.floor((ripple.y - reach) / CELL_H))
    const r1 = Math.min(rows - 1, Math.ceil((ripple.y + reach) / CELL_H))

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot((c + 0.5) * CELL_W - ripple.x, (r + 0.5) * CELL_H - ripple.y)
        const k = (d - radius) / BAND
        const wave = k > 0 ? Math.exp(-k * k * 4) : Math.exp(k * 1.5) * 0.45

        if (wave * fade < 0.02) continue
        const i = r * cols + c

        if (energy[i] === 0) touched.push(i)
        energy[i]! += wave * fade
      }
    }
  }
}

function draw(now: number) {
  const el = canvas.value
  const ctx = el?.getContext("2d")

  while (ripples.length && (now - ripples[0]!.start) / 1000 > LIFE) ripples.shift()

  if (!el || !ctx) return
  const { width, height, cols } = size.value

  ctx.clearRect(0, 0, width, height)

  if (!ripples.length) {
    loop.pause()
    return
  }

  const style = getComputedStyle(el)
  const touched: number[] = []
  const tick = Math.floor(now / 70)

  ctx.font = `${style.fontSize} ${style.fontFamily}`
  ctx.fillStyle = style.color
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  accumulate(now, touched)

  for (const i of touched) {
    ctx.globalAlpha = Math.min(0.85, energy[i]!)
    // 字形随时间轮换：每格起点不同，看起来是在闪动而不是整片同步
    ctx.fillText(
      GLYPHS[(seeds[i]! + tick) % GLYPHS.length]!,
      ((i % cols) + 0.5) * CELL_W,
      (Math.floor(i / cols) + 0.5) * CELL_H,
    )
    energy[i] = 0
  }

  ctx.globalAlpha = 1
}

const loop = useRafFn(({ timestamp }) => draw(timestamp), { immediate: false })

useResizeObserver(canvas, resize)

onMounted(resize)

useEventListener(host, "pointerdown", (event: PointerEvent) => {
  const el = canvas.value
  const target = event.target

  if (!el || event.button !== 0 || prefersReducedMotion()) return

  if (target instanceof Element && target.closest(INTERACTIVE)) return
  const rect = el.getBoundingClientRect()

  if (ripples.length >= MAX_RIPPLES) ripples.shift()
  ripples.push({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    start: performance.now(),
  })
  loop.resume()
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
