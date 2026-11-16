<template>
  <div ref="column" class="panel-column">
    <SplitterGroup
      :key="layoutKey"
      direction="vertical"
      :auto-save-id="`pig.panels.${layoutKey}`"
      class="panel-column-group"
    >
      <template v-for="(kind, index) in host.visible.value" :key="kind">
        <SplitterResizeHandle v-if="index > 0" class="panel-column-handle" />

        <SplitterPanel
          :order="index + 1"
          :min-size="PANEL_MIN_HEIGHT"
          size-unit="px"
          class="panel-column-slot"
        >
          <div :ref="(el) => mount(kind, el)" class="panel-column-mount"></div>
        </SplitterPanel>
      </template>
    </SplitterGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from "reka-ui"
import { PANEL_MIN_HEIGHT } from "@features/split-view/lib/panel-stack.js"
import type { PanelHost, PanelKind } from "@features/split-view/index.js"

const props = defineProps<{ host: PanelHost }>()
const column = useTemplateRef("column")
const layoutKey = computed(() => props.host.visible.value.join("-"))

useResizeObserver(column, ([entry]) => {
  if (entry) props.host.setHeight(entry.contentRect.height)
})

const mine = new Map<PanelKind, HTMLElement>()

/** 挂载点给到对应面板，面板自己 Teleport 进来；只撤自己登记的那一个。 */
function mount(kind: PanelKind, el: unknown) {
  if (el instanceof HTMLElement) {
    mine.set(kind, el)
    props.host.slots.set(kind, el)
    return
  }

  if (props.host.slots.get(kind) === mine.get(kind)) props.host.slots.delete(kind)
  mine.delete(kind)
}
</script>

<style scoped>
.panel-column {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.panel-column-group {
  flex: 1;
}

.panel-column-slot,
.panel-column-mount {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.panel-column-mount {
  flex: 1;
}

/* 上下两个面板之间一条 1px 分割线，上下各留几像素的拖拽区 */
.panel-column-handle {
  position: relative;
  block-size: var(--border-width);
  background: var(--border-soft);
  cursor: row-resize;
}

.panel-column-handle::after {
  content: "";
  position: absolute;
  inset: calc(-1 * var(--space-xxs)) 0;
}

.panel-column-handle:focus-visible {
  outline: var(--focus-ring);
}
</style>
