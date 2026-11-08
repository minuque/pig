<template>
  <div class="effort-card" :style="geometry">
    <Tooltip>
      <TooltipTrigger as-child>
        <IconButton
          type="button"
          size="s"
          variant="ghost"
          class="effort-reset"
          :aria-label="t('composer.restoreDefaultEffort')"
          :disabled="index === 0"
          @click="commit(0)"
        >
          <RestartIcon aria-hidden="true" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ t("composer.restoreDefault") }}</TooltipContent>
    </Tooltip>

    <div ref="rootRef" class="root" :data-dragging="dragging ? 'true' : 'false'">
      <svg class="shell" :viewBox="`0 0 ${track} ${BUMP_H + HEIGHT}`" aria-hidden="true">
        <defs>
          <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--effort-shell)" />
            <stop offset="1" stop-color="var(--effort-shell-2)" />
          </linearGradient>
        </defs>

        <path
          :d="view.path"
          :fill="`url(#${gradId})`"
          stroke="var(--effort-line)"
          stroke-width="0.5"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <div ref="labelRef" class="label" :style="view.labelStyle">
        <span :key="view.level" class="swap motion-blur-in">
          <span class="current">{{ t("composer.thinkingEffort") }}</span>
          <span class="next">{{ view.levelLabel }}</span>
        </span>
      </div>

      <div
        ref="trackRef"
        class="track"
        role="slider"
        tabindex="0"
        :aria-label="t('composer.thinkingEffort')"
        aria-valuemin="0"
        :aria-valuemax="steps"
        :aria-valuenow="view.active"
        :aria-valuetext="view.levelLabel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeyDown"
      >
        <div class="fill" :style="{ width: `${view.fillW}px` }" />
        <div class="thumb" :style="view.thumbStyle" />

        <span
          v-for="(level, index) in levels"
          :key="level"
          class="tick"
          :data-on-thumb="onThumb(index) ? 'true' : 'false'"
          :data-active="index === view.active && !onThumb(index) ? 'true' : 'false'"
          :style="{
            left: `${centerFor(index, steps, track)}px`,
            height: `${tickHeight(index, steps)}px`,
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core"
import { computed, nextTick, ref, useId, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { displayThinkingLevel, formatThinkingLevel } from "@features/composer/lib/thinking-level.js"
import {
  BUMP_H,
  centerFor,
  clamp,
  DRAG_W,
  EDGE_PAD,
  HEIGHT,
  RADIUS,
  REST_H,
  REST_W,
  plateauFor,
  shellGeom,
  shellPath,
  tickHeight,
  tween,
} from "@features/composer/lib/effort-shell.js"
import { RestartIcon } from "@components/icons/index.js"

const { t } = useI18n()
const props = defineProps<{
  levels: readonly string[]
  level: string
}>()
const emit = defineEmits<{
  "update:level": [value: string]
}>()
const gradId = `effort-${useId()}`
const rootRef = useTemplateRef("rootRef")
const trackRef = useTemplateRef("trackRef")
const labelRef = useTemplateRef("labelRef")
const current = computed(() => displayThinkingLevel(props.level, props.levels))
const index = computed(() => Math.max(0, props.levels.indexOf(current.value)))
const steps = computed(() => Math.max(props.levels.length - 1, 0))
// 轨道宽度跟随面板，几何全部按实测宽度算
const track = ref(224)
const display = ref(index.value)
const open = ref(0)
const dragging = ref(false)
const textW = ref(64)
const plateauW = ref(plateauFor(64))
const reveal = ref(0)
// 尺寸全部出自几何常量，样式里只读这几个变量
const geometry = {
  "--effort-h": `${HEIGHT}px`,
  "--effort-root-h": `${BUMP_H + HEIGHT}px`,
}

useResizeObserver(rootRef, (entries) => {
  const width = entries[0]?.contentRect.width ?? 0

  if (width > 0) track.value = width
})

// 外部改档（重置、换模型）时跟上；拖动中以指针为准
watch(index, (next) => {
  if (!dragging.value) display.value = next
})

const view = computed(() => {
  const center = centerFor(display.value, steps.value, track.value)
  const thumbW = REST_W + (DRAG_W - REST_W) * open.value
  let thumbLeft = center - thumbW / 2
  let thumbRight = thumbLeft + thumbW

  if (thumbLeft < EDGE_PAD) {
    thumbLeft = EDGE_PAD
    thumbRight = thumbLeft + thumbW
  }

  if (thumbRight > track.value - EDGE_PAD) {
    thumbRight = track.value - EDGE_PAD
    thumbLeft = thumbRight - thumbW
  }

  const active = Math.round(display.value)
  const level = props.levels[active] ?? ""
  const plateau = shellGeom(center, plateauW.value, track.value)
  const labelX = (plateau.topL + plateau.topR) / 2 + (plateau.insetL - plateau.insetR) / 2
  return {
    path: shellPath(center, open.value, plateauW.value, track.value),
    fillW: Math.min(track.value, thumbRight + EDGE_PAD),
    thumbLeft,
    thumbRight,
    active,
    level,
    levelLabel: formatThinkingLevel(level),
    labelStyle: {
      left: `${labelX}px`,
      opacity: reveal.value,
      filter: reveal.value > 0.98 ? undefined : `blur(${((1 - reveal.value) * 3).toFixed(2)}px)`,
      transform: `translate(-50%, ${3 * (1 - open.value)}px)`,
    },
    thumbStyle: {
      left: `${thumbLeft}px`,
      width: `${thumbW}px`,
      height: `${REST_H}px`,
      marginTop: `${-REST_H / 2}px`,
    },
  }
})

function onThumb(i: number) {
  const x = centerFor(i, steps.value, track.value)
  return x >= view.value.thumbLeft + 0.5 && x <= view.value.thumbRight - 0.5
}

// 拖动开合：滑块变宽、凸台长出；松手时吸附到最近一档
watch(dragging, (isDragging, _, onCleanup) => {
  const fromOpen = open.value
  const fromValue = display.value
  const target = isDragging ? fromValue : Math.round(fromValue)

  onCleanup(
    tween(0, 1, 220, (e) => {
      open.value = fromOpen + ((isDragging ? 1 : 0) - fromOpen) * e

      if (!isDragging) display.value = fromValue + (target - fromValue) * e
    }),
  )
})

// 标签出现：拖动时延后 85ms 淡入 132ms，松手 90ms 淡出
watch(dragging, (isDragging, _, onCleanup) => {
  onCleanup(
    tween(
      reveal.value,
      isDragging ? 1 : 0,
      isDragging ? 132 : 90,
      (value) => (reveal.value = value),
      isDragging ? 85 : 0,
    ),
  )
})

// 凸台宽度跟着标签文字宽度走
watch(
  () => plateauFor(textW.value),
  (to, _, onCleanup) => {
    if (Math.abs(to - plateauW.value) < 0.3) {
      plateauW.value = to
      return
    }

    onCleanup(tween(plateauW.value, to, 90, (value) => (plateauW.value = value)))
  },
)

watch(
  () => view.value.level,
  async () => {
    await nextTick()
    const w = labelRef.value?.getBoundingClientRect().width ?? 0

    if (w > 0 && Math.abs(w - textW.value) > 0.4) textW.value = w
  },
  { flush: "post", immediate: true },
)

function commit(next: number) {
  display.value = next
  const level = props.levels[Math.round(next)]

  if (level && level !== current.value) emit("update:level", level)
}

function valueFrom(clientX: number) {
  const rect = trackRef.value?.getBoundingClientRect()

  if (!rect || steps.value === 0) return 0
  const ratio = (clientX - rect.left - RADIUS) / (rect.width - RADIUS * 2)
  return clamp(ratio * steps.value, 0, steps.value)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const el = event.currentTarget

  if (el instanceof HTMLElement) el.setPointerCapture(event.pointerId)
  dragging.value = true
  commit(valueFrom(event.clientX))
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) commit(valueFrom(event.clientX))
}

function onPointerUp(event: PointerEvent) {
  if (!dragging.value) return
  const el = event.currentTarget

  if (el instanceof HTMLElement && el.hasPointerCapture(event.pointerId)) {
    el.releasePointerCapture(event.pointerId)
  }

  dragging.value = false
}

function onKeyDown(event: KeyboardEvent) {
  const now = Math.round(display.value)
  const targets: Record<string, number> = {
    ArrowRight: Math.min(steps.value, now + 1),
    ArrowUp: Math.min(steps.value, now + 1),
    ArrowLeft: Math.max(0, now - 1),
    ArrowDown: Math.max(0, now - 1),
    Home: 0,
    End: steps.value,
  }
  const next = targets[event.key]

  if (next === undefined) return
  event.preventDefault()
  commit(next)
}
</script>

<style scoped>
.effort-card {
  position: relative;
  /* 顶部留出恢复默认按钮的高度，按钮不压轨道 */
  padding: var(--space-md) var(--space-xs) var(--space-xs);
}

/* 恢复默认：贴在卡片右上角，浮在凸台之上 */
.effort-reset {
  position: absolute;
  inset-block-start: var(--space-xxs);
  inset-inline-end: var(--space-xxs);
  z-index: 4;
}

.effort-reset svg {
  width: 14px;
  height: 14px;
}

/* 以下照参考实现，整体缩到 2/3：下方轨道，上方留给拖动时长出的标签凸台 */
.root {
  position: relative;
  width: 100%;
  height: var(--effort-root-h);
  user-select: none;
  touch-action: none;
  font-family: inherit;
}

.shell {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.label {
  position: absolute;
  top: 1px;
  z-index: 2;
  font-size: 9px;
  font-weight: 500;
  line-height: 12px;
  letter-spacing: -0.01em;
  white-space: nowrap;
  pointer-events: none;
}

.swap {
  display: flex;
  gap: 3px;
}

.current {
  color: var(--effort-label);
}

.next {
  color: var(--effort-label-dim);
}

.track {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--effort-h);
  border-radius: var(--radius-pill);
  cursor: grab;
}

.root[data-dragging="true"] .track {
  cursor: grabbing;
}

.fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: var(--radius-pill);
  background: var(--effort-fill);
  box-shadow: var(--effort-fill-highlight);
  pointer-events: none;
}

.thumb {
  position: absolute;
  top: 50%;
  z-index: 2;
  border-radius: var(--radius-pill);
  background: var(--effort-thumb);
  box-shadow: var(--effort-thumb-shadow);
  pointer-events: none;
}

.tick {
  position: absolute;
  top: 50%;
  z-index: 3;
  width: 1.5px;
  margin-left: -0.75px;
  border-radius: 1px;
  background: var(--effort-tick);
  transform: translateY(-50%);
  pointer-events: none;
}

.tick[data-active="true"] {
  background: var(--effort-tick-active);
}

.tick[data-on-thumb="true"] {
  background: var(--effort-tick-on-thumb);
}

.track:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}
</style>
