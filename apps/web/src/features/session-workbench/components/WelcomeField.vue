<template>
  <canvas ref="canvas" class="welcome-field" aria-hidden="true"></canvas>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue"
import { useRafFn, useResizeObserver } from "@vueuse/core"
import { prefersReducedMotion } from "@utils/motion.js"
import { MASK_FRAG, MASK_VERT } from "@features/session-workbench/lib/mask-flow-shader.js"

/** 格子边长（CSS px）。 */
const CELL = 10
const UNIFORMS = ["uResolution", "uTime", "uCell", "uGain", "uMask", "uLow", "uHigh"]
const canvas = useTemplateRef<HTMLCanvasElement>("canvas")
let gl: WebGL2RenderingContext | null = null
let uniforms: Record<string, WebGLUniformLocation | null> = {}
let dpr = 1
let time = 0
let last = 0
let probe: CanvasRenderingContext2D | null = null

function compile(ctx: WebGL2RenderingContext, type: number, source: string) {
  const shader = ctx.createShader(type)!
  ctx.shaderSource(shader, source)
  ctx.compileShader(shader)
  return shader
}

function setup(el: HTMLCanvasElement) {
  const ctx = el.getContext("webgl2", { premultipliedAlpha: true, antialias: false })

  if (!ctx) return
  const program = ctx.createProgram()
  ctx.attachShader(program, compile(ctx, ctx.VERTEX_SHADER, MASK_VERT))
  ctx.attachShader(program, compile(ctx, ctx.FRAGMENT_SHADER, MASK_FRAG))
  ctx.linkProgram(program)

  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) return
  ctx.useProgram(program)
  ctx.bindBuffer(ctx.ARRAY_BUFFER, ctx.createBuffer())
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW)
  const pos = ctx.getAttribLocation(program, "pos")
  ctx.enableVertexAttribArray(pos)
  ctx.vertexAttribPointer(pos, 2, ctx.FLOAT, false, 0, 0)
  uniforms = Object.fromEntries(
    UNIFORMS.map((name) => [name, ctx.getUniformLocation(program, name)]),
  )
  gl = ctx
}

/** token 颜色经 2d 画布换成 0-1 的 RGB。 */
function rgb(color: string): [number, number, number] {
  probe ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })!
  probe.fillStyle = color
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return [r! / 255, g! / 255, b! / 255]
}

function resize() {
  const el = canvas.value

  if (!el || !gl) return
  const { width, height } = el.getBoundingClientRect()
  dpr = window.devicePixelRatio || 1
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  gl.viewport(0, 0, el.width, el.height)
  draw(performance.now())
}

function draw(now: number) {
  const el = canvas.value

  if (!el || !gl) return
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
  last = now
  time += dt
  const style = getComputedStyle(el)
  gl.uniform2f(uniforms.uResolution!, el.width, el.height)
  gl.uniform1f(uniforms.uTime!, time)
  gl.uniform1f(uniforms.uCell!, CELL * dpr)
  gl.uniform1f(uniforms.uGain!, 1)
  gl.uniform1f(uniforms.uMask!, 1)
  gl.uniform3fv(uniforms.uLow!, rgb(style.getPropertyValue("--welcome-flow-low")))
  gl.uniform3fv(uniforms.uHigh!, rgb(style.getPropertyValue("--welcome-flow-high")))
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

const loop = useRafFn(({ timestamp }) => draw(timestamp), { immediate: false })

useResizeObserver(canvas, resize)

onMounted(() => {
  if (canvas.value) setup(canvas.value)
  resize()

  if (!prefersReducedMotion()) loop.resume()
})

onBeforeUnmount(() => gl?.getExtension("WEBGL_lose_context")?.loseContext())
</script>

<style scoped>
/* 铺满欢迎页背景，不接点击 */
.welcome-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
