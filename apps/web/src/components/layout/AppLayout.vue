<template>
  <div class="shell" :class="[sbClass, { 'is-resizing': resizing }]">
    <aside
      class="sidebar"
      :class="[sbState]"
      :style="sbState === 'expanded' ? leftWidthStyle : undefined"
      :inert="isOffcanvas"
      :aria-hidden="isOffcanvas"
    >
      <slot name="sidebar" :on-navigate="closeMobilePanels" />
    </aside>

    <ResizeHandle
      v-if="sbState === 'expanded'"
      class="resizer"
      tabindex="0"
      data-orientation="horizontal"
      :data-state="resizing ? 'drag' : undefined"
      @pointerdown="startResize($event)"
      @keydown.left.prevent="resizeBy(-16)"
      @keydown.right.prevent="resizeBy(16)"
      @dblclick="resetWidth"
    />

    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue"
import { useEventListener } from "@vueuse/core"
import { leftPanelKey, useLeftPanel } from "@components/layout/hooks/use-left-panel.js"
import { ResizeHandle } from "@components/ui/resize-handle/index.js"

defineSlots<{
  default(): unknown
  sidebar(props: { onNavigate: () => void }): unknown
}>()

const {
  leftOpen,
  sbState,
  setSbState,
  leftWidth,
  resizing,
  sbAnimating,
  isNarrow,
  toggle,
  resizeBy,
  startResize,
  closeMobilePanels,
} = useLeftPanel()
const leftWidthStyle = computed(() => ({ "--left-width": `${leftWidth.value}px` }))
const sbClass = computed(() => `sb-${sbState.value}`)
const isOffcanvas = computed(() => sbState.value === "offcanvas")

provide(leftPanelKey, {
  leftOpen,
  sbState,
  setSbState,
  toggle,
  resizing,
  sbAnimating,
  isNarrow,
})

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return
  event.preventDefault()
  setSbState(sbState.value === "expanded" ? "offcanvas" : "expanded")
})

function resetWidth() {
  resizeBy(0)
}
</script>

<style scoped>
.shell {
  position: relative;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: var(--bg);
}

.sidebar {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-sunken);
  border-inline-end: var(--border-width) solid var(--border-subtle);
  contain: layout style;
  visibility: hidden;
  width: 0;
  border-inline-end-width: 0;
  transition:
    width var(--duration-normal) var(--ease-out),
    border-inline-end-width 0s var(--duration-normal),
    visibility 0s var(--duration-normal);
}

.sidebar.expanded {
  visibility: visible;
  width: var(--left-width);
  border-inline-end-width: var(--border-width);
  transition:
    width var(--duration-normal) var(--ease-out),
    border-inline-end-width 0s,
    visibility 0s;
}

/* 把手不占位：贴着侧栏边界浮着；外观由 ResizeHandle 画 */
.resizer {
  z-index: var(--z-resizer);
  align-self: stretch;
  width: 0;
}

html[data-pig-desktop-platform="darwin"] .resizer {
  /* 把手只在标题条以下生效，顶部条带留给拖窗 */
  margin-block-start: var(--titlebar-inset);
}

.shell.is-resizing {
  cursor: ew-resize;
  user-select: none;
}

.shell.is-resizing .sidebar {
  transition: none;
  will-change: width;
}

.shell.is-resizing main {
  pointer-events: none;
}

main {
  position: relative;
  /* 困住栏内 z-index：用 z-index:0 而不是 isolation:isolate */
  z-index: 0;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}

@media (max-width: 900px) {
  .shell,
  .shell.sb-offcanvas {
    height: 100dvh;
    display: block;
    padding: 0;
  }

  main {
    height: 100dvh;
  }

  .resizer {
    display: none;
  }

  .sidebar,
  .shell.sb-offcanvas .sidebar {
    position: fixed;
    z-index: var(--z-drawer);
    inset-block: 0;
    inset-inline-start: 0;
    width: min(88vw, var(--drawer-width));
    visibility: hidden;
    transform: translateX(-105%);
    transition:
      transform var(--duration-normal) var(--ease-out),
      visibility 0s linear var(--duration-normal);
    background: var(--bg-sunken);
    border-inline-end: 0;
    box-shadow: var(--shadow-dialog);
  }

  .sidebar.expanded {
    visibility: visible;
    transform: translateX(0);
    transition:
      transform var(--duration-normal) var(--ease-out),
      visibility 0s linear;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* 置于末尾，覆盖上方 media 块内的 transition */
  .sidebar {
    transition: none;
    animation: none;
  }
}
</style>
