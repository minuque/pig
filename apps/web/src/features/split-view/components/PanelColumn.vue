<template>
  <div ref="column" class="panel-column">
    <SplitterGroup
      :key="layoutKey"
      direction="vertical"
      :auto-save-id="`pig.panels.${layoutKey}`"
      class="panel-column-group"
    >
      <template v-for="(kind, index) in host.visible.value" :key="kind">
        <SplitterResizeHandle v-if="index > 0" as-child class="panel-column-handle">
          <ResizeHandle />
        </SplitterResizeHandle>

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
import { ResizeHandle } from "@components/ui/resize-handle/index.js"
import { PANEL_MIN_HEIGHT } from "@features/split-view/lib/panel-stack.js"
import type { PanelHost, PanelKind } from "@features/split-view/index.js"

const props = defineProps<{ host: PanelHost }>()
const column = useTemplateRef("column")
const layoutKey = computed(() => props.host.visible.value.join("-"))

useResizeObserver(column, ([entry]) => {
  if (entry) props.host.setHeight(entry.contentRect.height)
})

const mine = new Map<PanelKind, HTMLElement>()

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

.panel-column-handle {
  block-size: var(--space-sm);
}
</style>
