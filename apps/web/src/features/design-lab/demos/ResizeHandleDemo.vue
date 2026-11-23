<template>
  <Story title="ResizeHandle">
    <Variant title="Horizontal">
      <div class="demo-split-x">
        <div class="demo-pane" :style="{ inlineSize: `${leftWidth}px` }">
          Left ({{ Math.round(leftWidth) }}px)
        </div>

        <ResizeHandle
          class="demo-handle-x"
          tabindex="0"
          :data-dragging="dragging ? '' : undefined"
          @pointerdown="onPointerDown"
        />

        <div class="demo-pane demo-pane-fill">Right</div>
      </div>
    </Variant>

    <Variant title="Vertical">
      <div class="demo-split-y">
        <div class="demo-pane-y">Top</div>
        <ResizeHandle class="demo-handle-y" tabindex="0" data-orientation="vertical" />
        <div class="demo-pane-y">Bottom</div>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { ref } from "vue"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { dragResize, ResizeHandle } from "@components/ui/resize-handle/index.js"

const leftWidth = ref(180)
const dragging = ref(false)

function onPointerDown(event: PointerEvent) {
  const start = leftWidth.value
  const started = dragResize(event, {
    move(delta) {
      leftWidth.value = Math.min(320, Math.max(100, start + delta))
    },
    end(delta) {
      leftWidth.value = Math.min(320, Math.max(100, start + delta))
      dragging.value = false
    },
  })

  if (started) dragging.value = true
}
</script>

<style scoped>
.demo-split-x {
  display: flex;
  align-items: stretch;
  block-size: 96px;
  border-radius: var(--radius-card);
  background: var(--bg);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  overflow: hidden;
}

.demo-pane {
  flex: none;
  display: grid;
  place-items: center;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.demo-pane-fill {
  flex: 1;
}

.demo-handle-x {
  inline-size: 1px;
  background: var(--border);
}

.demo-split-y {
  display: flex;
  flex-direction: column;
  block-size: 140px;
  border-radius: var(--radius-card);
  background: var(--bg);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  overflow: hidden;
}

.demo-pane-y {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

.demo-handle-y {
  block-size: 1px;
  background: var(--border);
}
</style>
