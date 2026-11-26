<template>
  <div ref="root" class="pane-body">
    <div class="pane-track" :style="{ '--pane-index': index }">
      <section
        v-for="view in PANE_VIEWS"
        :key="view"
        class="pane-view"
        :data-view="view"
        :inert="view !== current || undefined"
      >
        <slot v-if="view === 'chat' || visited.has(view)" :name="view" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowReactive, useTemplateRef, watch } from "vue"
import { useSwipePager } from "@features/split-view/hooks/use-swipe-pager.js"
import { PANE_VIEWS, type PaneView } from "@features/split-view/lib/split-state.js"

const props = defineProps<{ current: PaneView }>()
const emit = defineEmits<{ step: [delta: 1 | -1] }>()
const root = useTemplateRef("root")
const index = computed(() => PANE_VIEWS.indexOf(props.current))
const visited = shallowReactive(new Set<PaneView>())

watch(
  () => props.current,
  (view) => visited.add(view),
  { immediate: true },
)

useSwipePager(root, (delta) => emit("step", delta))
</script>

<style scoped>
.pane-body {
  position: relative;
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pane-track {
  flex: 1;
  display: grid;
  grid-auto-columns: 100%;
  grid-auto-flow: column;
  min-width: 0;
  min-height: 0;
  transform: translateX(calc(var(--pane-index) * -100%));
  transition: transform var(--duration-slow) var(--ease-out);
}

.pane-view {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.pane-view[data-view="files"] {
  padding: 0 var(--space-sm) calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
}

@media (prefers-reduced-motion: reduce) {
  .pane-track {
    transition: none;
  }
}
</style>
