<template>
  <div ref="root" class="pane-body">
    <Resizable orientation="horizontal" auto-save-id="pig.files.split" class="pane-body-group">
      <ResizablePanel id="chat" :min-size="`${CHAT_MIN}px`" class="pane-body-chat">
        <slot />
      </ResizablePanel>

      <template v-if="docked">
        <ResizableHandle>
          <template #render="{ props: part }">
            <ResizeHandle v-bind="part" class="pane-body-handle" />
          </template>
        </ResizableHandle>

        <ResizablePanel
          id="panels"
          :default-size="PANE_DEFAULT"
          :min-size="PANE_MIN"
          class="pane-body-column pane-enter"
        >
          <PanelColumn :host="host" />
        </ResizablePanel>
      </template>
    </Resizable>

    <div v-if="covering" class="pane-body-cover pane-enter">
      <PanelColumn :host="host" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch, watchEffect } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/vue/resizable"
import { ResizeHandle } from "@pig/ui/resize-handle"
import PanelColumn from "@features/panel-host/components/PanelColumn.vue"
import type { PanelHost } from "@features/panel-host/index.js"

const CHAT_MIN = 640
const PANE_MIN_WIDTH = 320
const PANE_MIN = `${PANE_MIN_WIDTH}px`
const PANE_DEFAULT = "560px"
const props = defineProps<{ host: PanelHost }>()
const root = useTemplateRef("root")
const width = shallowRef(Number.POSITIVE_INFINITY)
const shown = computed(() => props.host.order.value.length > 0)
const narrow = computed(() => width.value < CHAT_MIN + PANE_MIN_WIDTH)
const docked = computed(() => shown.value && !narrow.value && !props.host.expanded.value)
const covering = computed(() => shown.value && (narrow.value || props.host.expanded.value))

watchEffect(() => {
  props.host.covering.value = covering.value
  props.host.narrow.value = narrow.value
})

watch(shown, (open) => {
  if (!open) props.host.expanded.value = false
})

useResizeObserver(root, ([entry]) => {
  if (entry) width.value = entry.contentRect.width
})
</script>

<style scoped>
.pane-body {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
}

.pane-body-group {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-body-chat {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.pane-body-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0 var(--space-sm) calc(var(--space-sm) + env(safe-area-inset-bottom, 0px)) 0;
}

.pane-body-handle {
  inline-size: var(--space-sm);
}

.pane-body-cover {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  padding: 0 var(--space-sm) calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  background: var(--bg);
}
</style>
