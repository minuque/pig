<template>
  <div class="diagram" :data-view="view">
    <!-- 画好后不放按钮：点图进预览，复制源码在预览头部 -->
    <div v-if="!drawn" class="diagram-actions">
      <CopyButton :text="source" :label="t('transcript.copyCode')" />
    </div>

    <!-- 画布始终可见：pele 对隐藏容器会推迟绘制 -->
    <div
      ref="host"
      class="diagram-canvas mermaid-diagram"
      :data-zoomable="drawn || undefined"
      @click="openPreview"
    />

    <div v-if="view === 'source'" class="diagram-source">{{ source }}</div>

    <MermaidPreview
      v-if="preview"
      v-model:open="previewOpen"
      :svg="preview.svg"
      :width="preview.width"
      :height="preview.height"
      :type="preview.type"
      :source="source"
      :title="previewTitle"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue"
import type { Mounted, RenderResult } from "pele/lazy"
import { useI18n } from "@i18n/index.js"
import CopyButton from "@features/transcript-view/components/CopyButton.vue"
import MermaidPreview from "@features/transcript-view/components/markdown/MermaidPreview.vue"
import { headingBefore } from "@features/transcript-view/lib/nearest-heading.js"
import {
  cachedDiagram,
  loadDiagramType,
  loadPele,
  settledSource,
  storeDiagram,
} from "@features/transcript-view/lib/mermaid-runtime.js"

const props = defineProps<{ source: string; live?: boolean }>()
const { t } = useI18n()
const host = useTemplateRef("host")
const mounted = shallowRef<Mounted | null>(null)
const previewOpen = ref(false)
const preview = shallowRef<RenderResult | null>(null)
const previewTitle = ref("")
const drawn = ref(false)
/** 从缓存贴上的定稿图；没有 pele 实例，预览直接用它。 */
const pasted = shallowRef<RenderResult | null>(null)
const view = computed(() => (drawn.value ? "diagram" : "source"))

/** 只把能解析通过的源码交给 pele：图随内容逐步长出来，半截语法不闪错误层。 */
async function draw(source: string, live: boolean) {
  const text = settledSource(source, live)

  if (!text || text === mounted.value?.source) return
  const hit = live || mounted.value ? undefined : cachedDiagram(text)

  if (hit && host.value) {
    host.value.innerHTML = hit.svg
    pasted.value = hit
    drawn.value = true
    return
  }

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
      onRender: () => {
        drawn.value = true
        // 回调挂在首次 mount 上，流式结束后的重绘也走这里：读当前源码与状态
        const current = mounted.value

        if (!props.live && current?.result) storeDiagram(current.source, current.result)
      },
    })

  // 首次绘制可能在 mount 返回前同步完成，回调里还拿不到实例
  if (!live && mounted.value.result) storeDiagram(mounted.value.source, mounted.value.result)
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
  preview.value = mounted.value?.result ?? pasted.value
  previewTitle.value = headingBefore(host.value) ?? "Mermaid"
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
