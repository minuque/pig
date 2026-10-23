<template>
  <div
    ref="viewport"
    class="canvas-viewport"
    tabindex="0"
    role="region"
    aria-label="组件画布"
    aria-describedby="canvas-help"
  >
    <p id="canvas-help" class="canvas-sr">
      拖动空白处平移。按住空格或中键可在预览上平移。方向键平移，加减号缩放。
    </p>

    <div ref="world" class="canvas-world">
      <CanvasItem
        v-for="item in canvasItems"
        :key="item.id"
        :item="item"
        :x="positions[item.id]?.x ?? item.x"
        :y="positions[item.id]?.y ?? item.y"
        @move="onMove(item.id, $event)"
      />
    </div>

    <CanvasControls ref="controls" @zoom="onZoom" @fit="onFit" @reset="onReset" />

    <p v-if="blockedHref" class="canvas-stay" aria-live="polite">
      链接留在画布内
      <input readonly :value="blockedHref" aria-label="被拦截的链接" />
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue"
import CanvasControls from "@/canvas/CanvasControls.vue"
import CanvasItem from "@/canvas/CanvasItem.vue"
import { clampAxis, defaultCamera, type Camera } from "@/canvas/camera.js"
import {
  LAYOUT_KEY,
  parseLayout,
  resolvePositions,
  serializeLayout,
  type AppTheme,
  type ThemePref,
} from "@/canvas/layout.js"
import { canvasItems, LABEL_BLOCK } from "@/canvas/registry.js"
import { mountSurface, type CanvasSurface } from "@/canvas/surface.js"
import { useColorScheme } from "@features/theme/index.js"
import { DEFAULT_THEME_ID, THEMES } from "@features/theme/lib/palette.js"

const viewport = useTemplateRef("viewport")
const world = useTemplateRef("world")
const controls = useTemplateRef("controls")
const blockedHref = shallowRef("")
const ids = new Set(canvasItems.map((item) => item.id))
const themeIds = new Set(THEMES.map((theme) => theme.id))
const stored = parseLayout(localStorage.getItem(LAYOUT_KEY), { ids, themeIds })
const positions = shallowRef(
  resolvePositions(
    canvasItems.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      width: Math.max(item.width, 180),
      height: item.height + LABEL_BLOCK,
    })),
    stored?.positions ?? {},
  ),
)
const { scheme, themeId, setScheme, setTheme } = useColorScheme()
const capturedAppTheme: AppTheme = {
  scheme: scheme.value,
  themeId: themeId.value,
}
let appTheme = stored?.appTheme ?? capturedAppTheme
let canvasTheme: ThemePref | null = stored?.theme ?? null
let restoredAppTheme = false
let surface: CanvasSurface | undefined
let saveTimer = 0
let ready = false

function themePref(): ThemePref | null {
  if (scheme.value !== "light" && scheme.value !== "dark") return null
  return { scheme: scheme.value, themeId: themeId.value ?? DEFAULT_THEME_ID }
}

function applyTheme(pref: ThemePref | null) {
  if (!pref) return
  const next = THEMES.find((theme) => theme.id === pref.themeId)

  if (!next) return
  setScheme(pref.scheme)
  setTheme(next.id === DEFAULT_THEME_ID ? null : next)
}

function restoreAppTheme() {
  if (restoredAppTheme) return
  restoredAppTheme = true
  setScheme(appTheme.scheme)
  const previous = THEMES.find((theme) => theme.id === appTheme.themeId)
  setTheme(previous && previous.id !== DEFAULT_THEME_ID ? previous : null)
  appTheme = capturedAppTheme
  writeLayout(surface?.getCamera() ?? stored?.camera ?? defaultCamera())
}

if (!stored?.appTheme) writeLayout(stored?.camera ?? defaultCamera())

applyTheme(stored?.theme ?? null)

function writeLayout(camera: Camera) {
  try {
    localStorage.setItem(
      LAYOUT_KEY,
      serializeLayout({
        camera,
        theme: canvasTheme,
        appTheme: restoredAppTheme ? null : appTheme,
        positions: positions.value,
      }),
    )
  } catch {
    // 配额或隐私模式失败时画布仍可用。
  }
}

function persist() {
  if (!surface) return
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    if (surface) writeLayout(surface.getCamera())
  }, 200)
}

function flush() {
  window.clearTimeout(saveTimer)

  if (surface) writeLayout(surface.getCamera())
}

function onMove(id: string, delta: { dx: number; dy: number }) {
  const current = positions.value[id]

  if (!current) return
  positions.value = {
    ...positions.value,
    [id]: { x: clampAxis(current.x + delta.dx), y: clampAxis(current.y + delta.dy) },
  }
  persist()
}

function onStay(event: Event) {
  const detail = event instanceof CustomEvent ? event.detail : ""
  blockedHref.value = typeof detail === "string" ? detail : ""
}

watch(
  [scheme, themeId],
  () => {
    if (!ready || restoredAppTheme) return
    canvasTheme = themePref()
    persist()
  },
  { flush: "sync" },
)

onMounted(() => {
  document.getElementById("startup-splash")?.remove()

  if (!viewport.value || !world.value) return
  surface = mountSurface({
    viewport: viewport.value,
    world: world.value,
    camera: stored?.camera ?? defaultCamera(),
    onZoomLabel: (zoom) => controls.value?.setZoomLabel(zoom),
    commitPosition: (id, point) => {
      positions.value = { ...positions.value, [id]: point }
    },
    save: () => persist(),
  })
  viewport.value.addEventListener("canvas-stay", onStay)
  window.addEventListener("pagehide", onPageHide)
  ready = true
})

function onPageHide() {
  flush()
  restoreAppTheme()
}

onBeforeUnmount(() => {
  ready = false
  window.removeEventListener("pagehide", onPageHide)
  flush()
  surface?.destroy()
  viewport.value?.removeEventListener("canvas-stay", onStay)
  restoreAppTheme()
})

function onZoom(factor: number) {
  surface?.zoomBy(factor)
}

function onFit() {
  surface?.fit()
}

function onReset() {
  surface?.reset()
}
</script>

<style scoped>
.canvas-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--background);
  color: var(--foreground);
  cursor: default;
  overscroll-behavior-x: none;
  touch-action: none;
}

.canvas-viewport:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.canvas-world {
  position: absolute;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  transform-origin: 0 0;
  cursor: default;
}

.canvas-viewport.is-gesturing,
.canvas-viewport.is-gesturing .canvas-world {
  cursor: default;
}

.canvas-stay {
  position: fixed;
  z-index: var(--z-menu);
  inset-block-end: var(--spacing-sm);
  inset-inline-start: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-xs);
  color: var(--foreground);
  font-size: var(--text-eyebrow);
}

.canvas-stay input {
  width: 16rem;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
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
