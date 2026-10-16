<template>
  <div class="shell" :class="[sbClass, { 'is-resizing': resizing }]">
    <aside
      v-if="!isOffcanvas"
      class="sidebar"
      :class="[sbState]"
      :style="sbState === 'expanded' ? leftWidthStyle : undefined"
    >
      <slot name="sidebar" :on-navigate="closeMobilePanels" />
    </aside>

    <div
      v-if="sbState === 'expanded'"
      class="resizer"
      tabindex="0"
      :style="leftWidthStyle"
      @pointerdown="startResize($event)"
      @keydown.left.prevent="resizeBy(-16)"
      @keydown.right.prevent="resizeBy(16)"
      @dblclick="resetWidth"
    ></div>

    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue"
import { useEventListener } from "@vueuse/core"
import { leftPanelKey, useLeftPanel } from "@components/layout/hooks/use-left-panel.js"

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
  isNarrow,
  toggle,
  resizeBy,
  startResize,
  closeMobilePanels,
} = useLeftPanel()
const leftWidthStyle = computed(() => ({ "--left-width": `${leftWidth.value}px` }))
const sbClass = computed(() => `sb-${sbState.value}`)
const isOffcanvas = computed(() => sbState.value === "offcanvas")

provide(leftPanelKey, { leftOpen, sbState, setSbState, toggle, resizing, isNarrow })

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return
  event.preventDefault()
  setSbState(sbState.value === "expanded" ? "icon" : "expanded")
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
  background: var(--card);
}

.sidebar {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sidebar);
  border-inline-end: var(--border-width) solid var(--border);
  contain: layout style;
  transition: width var(--duration-normal) var(--ease-smooth);
}

.sidebar.expanded {
  width: var(--left-width);
}

.sidebar.icon {
  width: 52px;
  border-inline-end-width: 0;
}

.resizer {
  position: absolute;
  inset-block: 0;
  inset-inline-start: var(--left-width);
  z-index: var(--z-resizer);
  width: var(--spacing-md);
  margin-inline-start: calc(-1 * var(--spacing-sm));
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

.resizer:hover {
  cursor: ew-resize;
}

.resizer::after {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: calc(var(--spacing-sm) - var(--border-width));
  width: var(--border-width);
  pointer-events: none;
  background: var(--border);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.resizer:hover::after,
.resizer:focus-visible::after,
.shell.is-resizing .resizer::after {
  opacity: 1;
}

.shell.is-resizing .resizer::after {
  width: 2px;
}

html[data-pig-desktop-platform] .resizer {
  inset-block-start: calc(6px + var(--titlebar-inset));
}

html[data-pig-desktop-platform="win32"] .resizer {
  inset-block-start: 0;
}

html[data-pig-desktop-platform="darwin"] .resizer {
  inset-block-start: 32px;
}

.shell.is-resizing {
  cursor: col-resize;
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
  z-index: 0;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 困住栏内 z-index，避免 dock 底色盖住分栏把手；isolation:isolate 会吃掉子树 backdrop-filter */
  background: var(--card);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .resizer,
  .resizer::after {
    transition: none;
  }
}

@media (min-width: 901px) {
  .shell.sb-offcanvas .sidebar {
    display: none;
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
    width: min(88vw, var(--size-drawer));
    visibility: hidden;
    transform: translateX(-105%);
    transition:
      transform var(--duration-normal) var(--ease-smooth),
      visibility 0s linear var(--duration-normal);
    background: var(--sidebar);
    border-inline-end: 0;
    box-shadow: var(--shadow-drawer);
  }

  .sidebar.expanded,
  .sidebar.icon {
    visibility: visible;
    transform: translateX(0);
    transition:
      transform var(--duration-normal) var(--ease-smooth),
      visibility 0s linear;
  }
}

@media (prefers-reduced-motion: reduce) {
  /* 置于末尾，覆盖上方 media 块内的 transition */
  .sidebar,
  .resizer,
  .resizer::after {
    transition: none;
    animation: none;
  }
}
</style>
