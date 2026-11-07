<template>
  <div class="diagram" :data-view="view">
    <div class="diagram-actions">
      <Tooltip v-if="drawn">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="modeLabel"
            @click.stop="showSource = !showSource"
          >
            <CodeSquareIcon v-if="!showSource" class="size-icon" />
            <ChartSquareIcon v-else class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ modeLabel }}</TooltipContent>
      </Tooltip>

      <CopyButton :text="source" :label="t('transcript.copyCode')" />
    </div>

    <!-- 画布始终可见：pele 对隐藏容器会推迟绘制 -->
    <div
      v-show="!showSource"
      ref="host"
      class="diagram-canvas mermaid-diagram"
      :data-zoomable="drawn || undefined"
      @click="openPreview"
    />

    <div v-if="view === 'source'" class="diagram-source">{{ source }}</div>

    <Dialog v-model:open="previewOpen">
      <DialogContent class="diagram-dialog" :aria-label="previewLabel">
        <MermaidPreview
          v-if="preview"
          :svg="preview.svg"
          :width="preview.width"
          :height="preview.height"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue"
import type { Mounted, RenderResult } from "pele/lazy"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Dialog, DialogContent } from "@components/ui/dialog/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { ChartSquareIcon, CodeSquareIcon } from "@components/icons/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import MermaidPreview from "@features/transcript-view/components/markdown/MermaidPreview.vue"
import {
  loadDiagramType,
  loadPele,
  settledSource,
} from "@features/transcript-view/lib/mermaid-runtime.js"

const props = defineProps<{ source: string; live?: boolean }>()
const { t } = useI18n()
const host = useTemplateRef("host")
const mounted = shallowRef<Mounted | null>(null)
const previewOpen = ref(false)
const preview = shallowRef<RenderResult | null>(null)
const previewLabel = computed(() => t("common.preview", { name: "Mermaid" }))
const drawn = ref(false)
const showSource = ref(false)
const view = computed(() => (drawn.value && !showSource.value ? "diagram" : "source"))
const modeLabel = computed(() =>
  showSource.value ? t("transcript.diagramShow") : t("transcript.diagramSource"),
)

/** 只把能解析通过的源码交给 pele：图随内容逐步长出来，半截语法不闪错误层。 */
async function draw(source: string, live: boolean) {
  const text = settledSource(source, live)

  if (!text || text === mounted.value?.source) return
  const pele = await loadPele()
  const type = pele.detectType(text)

  if (!type || !(await loadDiagramType(pele, type)) || !host.value) return

  try {
    pele.parse(text)
  } catch {
    return
  }

  if (mounted.value) mounted.value.update(text)
  else
    mounted.value = pele.mount(host.value, text, {
      links: false,
      images: false,
      zoom: false,
      autoDirection: false,
      onRender: () => (drawn.value = true),
    })
}

let queue = Promise.resolve()

// 串行绘制：pele 加载是异步的，避免两次绘制同时 mount。
watch(
  [() => props.source, () => props.live],
  ([source, live]) => {
    queue = queue.then(() => draw(source, live)).catch(() => undefined)
  },
  {
    immediate: true,
    flush: "post",
  },
)

/** 预览沿用正文里已排好的那张图，比例与所见一致，不再按弹框宽度重新排版。 */
function openPreview() {
  preview.value = mounted.value?.result ?? null
  previewOpen.value = preview.value !== null
}

onBeforeUnmount(() => mounted.value?.destroy())
</script>

<style scoped>
.diagram {
  position: relative;
  min-width: 0;
}

/* 控件浮在右上角，悬停或键盘聚焦时才出现，不顶动图的位置。 */
.diagram-actions {
  position: absolute;
  z-index: 1;
  top: 0;
  inset-inline-end: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  opacity: 0;
}

.diagram:hover .diagram-actions,
.diagram:focus-within .diagram-actions {
  opacity: 1;
}

.diagram-actions :deep(.copy-button) {
  position: static;
}

.diagram-canvas {
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.diagram-canvas[data-zoomable] {
  cursor: zoom-in;
}
</style>

<style>
/* 面板经 Portal 挂到 body，scoped 打不中；尺寸与设置弹窗同档 */
.diagram-dialog {
  display: flex;
  flex-direction: column;
  width: min(88vw, var(--size-settings-dialog-width));
  max-width: min(88vw, var(--size-settings-dialog-width));
  height: clamp(var(--size-settings-dialog-height-min), 85vh, var(--size-settings-dialog-height));
  max-height: none;
  overflow: hidden;
}
</style>
