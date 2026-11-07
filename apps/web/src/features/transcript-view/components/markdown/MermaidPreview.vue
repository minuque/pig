<template>
  <div class="preview">
    <div class="preview-bar">
      <Button type="button" size="s" variant="ghost" color="gray" @click="reset">
        <RestartIcon class="size-icon" />
        {{ t("transcript.diagramReset") }}
      </Button>

      <span class="preview-scale">{{ Math.round(scale * 100) }}%</span>

      <Tooltip v-for="action in actions" :key="action.key">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="action.label"
            @click="action.run"
          >
            <component :is="action.icon" class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ action.label }}</TooltipContent>
      </Tooltip>
    </div>

    <!-- 视口固定大小：图从左上角起算，按起始平移居中；滚轮以指针为中心缩放，任意缩放下都能拖动 -->
    <div ref="viewport" class="preview-viewport">
      <!-- eslint-disable-next-line vue/no-v-html -- pele 由源码生成的 SVG -->
      <div ref="stage" class="preview-stage mermaid-diagram" :style="stageSize" v-html="svg" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue"
import Panzoom, { type PanzoomObject } from "@panzoom/panzoom"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { MagnifierZoomInIcon, MagnifierZoomOutIcon, RestartIcon } from "@components/icons/index.js"

const props = defineProps<{ svg: string; width: number; height: number }>()
const { t } = useI18n()
const viewport = useTemplateRef("viewport")
const stage = useTemplateRef("stage")
const scale = ref(1)
const stageSize = computed(() => ({ width: `${props.width}px`, height: `${props.height}px` }))
// 适应窗口时四周留白；小图最多放大到 2 倍，避免糊成一片
const FIT_MARGIN = 0.92
const FIT_MAX = 2
let panzoom: PanzoomObject | null = null
const actions = computed(() => [
  {
    key: "out",
    label: t("transcript.diagramZoomOut"),
    icon: MagnifierZoomOutIcon,
    run: () => panzoom?.zoomOut(),
  },
  {
    key: "in",
    label: t("transcript.diagramZoomIn"),
    icon: MagnifierZoomInIcon,
    run: () => panzoom?.zoomIn(),
  },
])

function fitScale(box: HTMLElement): number {
  const fit = Math.min(box.clientWidth / props.width, box.clientHeight / props.height) * FIT_MARGIN
  return Math.min(fit, FIT_MAX)
}

function reset() {
  panzoom?.reset()
}

function onChange() {
  if (panzoom) scale.value = panzoom.getScale()
}

onMounted(() => {
  if (!viewport.value || !stage.value) return
  const fit = fitScale(viewport.value)

  // 变换原点放左上角，平移量按未缩放坐标算：居中即视口与缩放后图的差值一半
  panzoom = Panzoom(stage.value, {
    canvas: true,
    cursor: "grab",
    origin: "0 0",
    startScale: fit,
    startX: (viewport.value.clientWidth / fit - props.width) / 2,
    startY: (viewport.value.clientHeight / fit - props.height) / 2,
    minScale: fit / 4,
    maxScale: Math.max(fit * 8, 4),
    step: 0.2,
  })
  scale.value = fit
  stage.value.addEventListener("panzoomchange", onChange)
  viewport.value.addEventListener("wheel", panzoom.zoomWithWheel, { passive: false })
})

onBeforeUnmount(() => {
  if (panzoom) viewport.value?.removeEventListener("wheel", panzoom.zoomWithWheel)
  stage.value?.removeEventListener("panzoomchange", onChange)
  panzoom?.destroy()
})
</script>

<style scoped>
.preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: var(--space-xs);
}

/* 右侧给弹框自带的关闭按钮让位 */
.preview-bar {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  padding-inline-end: var(--size-icon-button);
}

.preview-scale {
  min-width: 4ch;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
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
