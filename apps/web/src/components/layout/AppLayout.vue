<template>
  <div
    class="shell"
    :class="{ 'left-closed': !leftOpen, 'is-resizing': resizing }"
    :style="{ '--left-width': `${leftWidth}px` }"
  >
    <aside class="sidebar" :class="{ open: leftOpen }" :inert="!leftOpen">
      <slot name="sidebar" :on-navigate="closeMobilePanels" :toggle="toggle" />
    </aside>
    <div
      v-if="leftOpen"
      class="resizer"
      tabindex="0"
      @pointerdown="startResize($event)"
      @keydown.left.prevent="resizeBy(-16)"
      @keydown.right.prevent="resizeBy(16)"
    ></div>

    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { provide } from "vue"
import { leftPanelKey, useLeftPanel } from "@components/layout/hooks/use-left-panel.js"

defineSlots<{
  default(): unknown
  sidebar(props: { onNavigate: () => void; toggle: () => void }): unknown
}>()

const { leftOpen, leftWidth, resizing, toggle, resizeBy, startResize, closeMobilePanels } =
  useLeftPanel()

provide(leftPanelKey, { leftOpen, toggle, resizing })
</script>

<style scoped>
.shell {
  --left-width: var(--size-sidebar);
  position: relative;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.sidebar {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  width: var(--left-width);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sidebar);
  contain: layout style;
  transition: width var(--duration-normal) var(--ease-smooth);
}

.resizer {
  position: absolute;
  inset-block: 0;
  left: var(--left-width);
  z-index: var(--z-resizer);
  width: 16px;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}
.resizer::after {
  pointer-events: none;
  position: absolute;
  inset-block: 0;
  left: 0;
  width: 1px;
  background: var(--hover-tint);
  transition: background var(--duration-fast) var(--ease-smooth);
  content: "";
}
.resizer:hover::after,
.shell.is-resizing .resizer::after {
  background: var(--hairline);
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
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 困住栏内 z-index，避免 dock 底色盖住分栏把手 */
  isolation: isolate;
  background: var(--main);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .resizer {
    transition: none;
  }
}

@media (min-width: 901px) {
  .shell.left-closed .sidebar {
    width: 0;
  }
}

@media (max-width: 900px) {
  .shell,
  .shell.left-closed {
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
  .left-closed .sidebar {
    position: fixed;
    z-index: var(--z-drawer);
    inset-block: 0;
    left: 0;
    width: min(88vw, var(--size-drawer));
    visibility: hidden;
    transform: translateX(-105%);
    transition:
      transform var(--duration-normal) var(--ease-smooth),
      visibility 0s linear var(--duration-normal);
    background: var(--sidebar);
    box-shadow: var(--shadow-drawer);
  }
  .sidebar.open {
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
  .resizer {
    transition: none;
    animation: none;
  }
}
</style>
