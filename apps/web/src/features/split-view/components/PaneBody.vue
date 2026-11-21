<template>
  <div ref="root" class="pane-body">
    <SplitterGroup direction="horizontal" auto-save-id="pig.files.split" class="pane-body-group">
      <SplitterPanel :order="1" :min-size="chatMin" size-unit="px" class="pane-body-chat">
        <slot />
      </SplitterPanel>

      <template v-if="docked">
        <SplitterResizeHandle as-child class="pane-body-handle">
          <ResizeHandle />
        </SplitterResizeHandle>

        <SplitterPanel
          :order="2"
          :default-size="PANE_DEFAULT"
          :min-size="PANE_MIN"
          size-unit="px"
          class="pane-body-column pane-enter"
        >
          <PanelColumn :host="host" />
        </SplitterPanel>
      </template>
    </SplitterGroup>

    <div v-if="covering" class="pane-body-cover pane-enter">
      <PanelColumn :host="host" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch, watchEffect } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from "reka-ui"
import { ResizeHandle } from "@components/ui/resize-handle/index.js"
import PanelColumn from "@features/split-view/components/PanelColumn.vue"
import { SPLIT_CHAT_MIN } from "@features/split-view/lib/split-state.js"
import type { PanelHost } from "@features/split-view/index.js"

const CHAT_MIN = 640
const PANE_MIN = 320
const PANE_DEFAULT = 560
const props = defineProps<{ host: PanelHost; split: boolean }>()
const root = useTemplateRef("root")
const width = shallowRef(Number.POSITIVE_INFINITY)
const chatMin = computed(() => (props.split ? SPLIT_CHAT_MIN : CHAT_MIN))
const shown = computed(() => props.host.order.value.length > 0)
const narrow = computed(() => width.value < chatMin.value + PANE_MIN)
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
}

.pane-body-chat {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.pane-body-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
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
