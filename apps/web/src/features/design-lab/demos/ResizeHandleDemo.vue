<template>
  <Story title="ResizeHandle">
    <Variant title="Horizontal">
      <Resizable class="demo-split-x">
        <ResizablePanel v-slot="{ state }" default-size="180px" min-size="100px" max-size="320px">
          <div class="demo-pane">Left ({{ Math.round(state.size) }}%)</div>
        </ResizablePanel>

        <ResizableHandle>
          <template #render="{ props: part }">
            <ResizeHandle v-bind="part" />
          </template>
        </ResizableHandle>

        <ResizablePanel>
          <div class="demo-pane">Right</div>
        </ResizablePanel>
      </Resizable>
    </Variant>

    <Variant title="Vertical">
      <Resizable orientation="vertical" class="demo-split-y">
        <ResizablePanel :min-size="20">
          <div class="demo-pane">Top</div>
        </ResizablePanel>

        <ResizableHandle>
          <template #render="{ props: part }">
            <ResizeHandle v-bind="part" />
          </template>
        </ResizableHandle>

        <ResizablePanel :min-size="20">
          <div class="demo-pane">Bottom</div>
        </ResizablePanel>
      </Resizable>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/vue/resizable"
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { ResizeHandle } from "@pig/ui/resize-handle"
</script>

<style scoped>
.demo-split-x,
.demo-split-y {
  border-radius: var(--radius-card);
  background: var(--bg);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  overflow: hidden;
}

.demo-split-x {
  block-size: 96px;
}

.demo-split-y {
  block-size: 140px;
}

.demo-pane {
  display: grid;
  place-items: center;
  block-size: 100%;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}
</style>
