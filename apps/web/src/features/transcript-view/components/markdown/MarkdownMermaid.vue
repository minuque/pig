<template>
  <div class="diagram" :data-view="view">
    <div v-if="!drawn" class="diagram-actions">
      <CopyButton :text="source" :label="t('transcript.copyCode')" />
    </div>

    <!-- 外部：pele 对隐藏容器会推迟绘制 -->
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
const pasted = shallowRef<RenderResult | null>(null)
const view = computed(() => (drawn.value ? "diagram" : "source"))

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
        const current = mounted.value

        if (!props.live && current?.result) storeDiagram(current.source, current.result)
      },
    })

  if (!live && mounted.value.result) storeDiagram(mounted.value.source, mounted.value.result)
}

let queue = Promise.resolve()

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

.diagram-actions {
  position: absolute;
  z-index: var(--z-raise);
  top: 0;
  inset-inline-end: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
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
