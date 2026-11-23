<template>
  <PreviewDialog
    v-model:open="open"
    class="diagram-dialog"
    :title="title"
    :meta="`${type} · ${width} × ${height}`"
  >
    <template #actions>
      <div class="preview-group">
        <template v-for="(action, index) in zooms" :key="action.key">
          <span v-if="index > 0" class="preview-scale">{{ Math.round(scale * 100) }}%</span>

          <Tooltip>
            <TooltipTrigger as-child>
              <IconButton
                type="button"
                size="s"
                variant="ghost"
                color="neutral"
                :aria-label="action.label"
                @click="action.run"
              >
                <component :is="action.icon" class="size-icon" />
              </IconButton>
            </TooltipTrigger>

            <TooltipContent>{{ action.label }}</TooltipContent>
          </Tooltip>
        </template>
      </div>

      <div class="preview-group" data-kind="text">
        <Button type="button" size="s" variant="ghost" color="neutral" @click="fit">
          {{ t("transcript.diagramFit") }}
        </Button>

        <Button type="button" size="s" variant="ghost" color="neutral" @click="actual">
          {{ t("transcript.diagramActual") }}
        </Button>
      </div>

      <Button type="button" size="s" variant="ghost" color="neutral" @click="copy(source)">
        <CheckIcon v-if="copied" class="size-icon" />
        <CopyIcon v-else class="size-icon" />
        {{ t("transcript.diagramCopySource") }}
      </Button>
    </template>

    <div ref="viewport" class="preview-viewport">
      <!-- eslint-disable-next-line vue/no-v-html -- pele 由源码生成的 SVG -->
      <div ref="stage" class="preview-stage mermaid-diagram" :style="stageSize" v-html="svg" />
    </div>
  </PreviewDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue"
import Panzoom, { type PanzoomObject } from "@panzoom/panzoom"
import { useClipboard } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { PlusIcon, CheckIcon, CopyIcon, MinusIcon } from "@components/icons/index.js"
import PreviewDialog from "@features/preview/index.vue"

const props = defineProps<{
  svg: string
  width: number
  height: number
  type: string
  source: string
  title: string
}>()
const open = defineModel<boolean>("open", { default: false })
const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const viewport = useTemplateRef("viewport")
const stage = useTemplateRef("stage")
const scale = ref(1)
const stageSize = computed(() => ({ width: `${props.width}px`, height: `${props.height}px` }))
const FIT_MARGIN = 0.92
const FIT_MAX = 2
let panzoom: PanzoomObject | null = null
const zooms = computed(() => [
  {
    key: "out",
    label: t("transcript.diagramZoomOut"),
    icon: MinusIcon,
    run: () => panzoom?.zoomOut(),
  },
  {
    key: "in",
    label: t("transcript.diagramZoomIn"),
    icon: PlusIcon,
    run: () => panzoom?.zoomIn(),
  },
])

function fitScale(box: HTMLElement): number {
  const fit = Math.min(box.clientWidth / props.width, box.clientHeight / props.height) * FIT_MARGIN
  return Math.min(fit, FIT_MAX)
}

function centered(box: HTMLElement, s: number) {
  return {
    x: (box.clientWidth / s - props.width) / 2,
    y: (box.clientHeight / s - props.height) / 2,
  }
}

function fit() {
  panzoom?.reset()
}

function actual() {
  if (!panzoom || !viewport.value) return
  const { x, y } = centered(viewport.value, 1)
  panzoom.zoom(1)
  panzoom.pan(x, y)
}

function onChange() {
  if (panzoom) scale.value = panzoom.getScale()
}

function setup(box: HTMLElement, el: HTMLElement) {
  const start = fitScale(box)
  const { x, y } = centered(box, start)

  panzoom = Panzoom(el, {
    canvas: true,
    cursor: "grab",
    origin: "0 0",
    startScale: start,
    startX: x,
    startY: y,
    minScale: start / 4,
    maxScale: Math.max(start * 8, 4),
    step: 0.2,
  })
  scale.value = start
  el.addEventListener("panzoomchange", onChange)
  box.addEventListener("wheel", panzoom.zoomWithWheel, { passive: false })
}

function teardown(box: HTMLElement | null, el: HTMLElement | null) {
  if (panzoom) box?.removeEventListener("wheel", panzoom.zoomWithWheel)
  el?.removeEventListener("panzoomchange", onChange)
  panzoom?.destroy()
  panzoom = null
}

watch(
  [viewport, stage],
  ([box, el], [oldBox, oldEl]) => {
    teardown(oldBox ?? null, oldEl ?? null)

    if (box && el) setup(box, el)
  },
  { flush: "post" },
)

onBeforeUnmount(() => teardown(viewport.value, stage.value))
</script>

<style scoped>
.preview-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.preview-group[data-kind="text"] {
  gap: var(--space-lg);
}

.preview-scale {
  min-width: 4ch;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.preview-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--radius-card);
  touch-action: none;
}

.preview-stage {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
}

.preview-stage :deep(svg) {
  display: block;
  width: 100%;
  max-width: none;
  height: 100%;
}
</style>

<style>
.diagram-dialog[data-slot="dialog-content"] {
  width: min(88vw, var(--dialog-width-lg));
  max-width: min(88vw, var(--dialog-width-lg));
  height: clamp(var(--dialog-height-lg-min), 85vh, var(--dialog-height-lg));
  max-height: none;
}
</style>
