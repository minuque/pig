<template>
  <div
    class="shell"
    :class="{ 'left-closed': !leftOpen, 'is-resizing': resizing }"
    :style="{ '--left-width': `${leftWidth}px` }"
  >
    <aside class="sidebar" :class="{ open: leftOpen }" aria-label="工作目录和会话导航">
      <slot
        name="sidebar"
        :on-navigate="closeMobilePanels"
        :collapsed="!leftOpen && !isNarrow"
        :toggle="toggle"
      />
      <div
        v-if="leftOpen"
        class="resizer"
        role="separator"
        aria-label="调整左栏宽度"
        aria-orientation="vertical"
        :aria-valuenow="leftWidth"
        aria-valuemin="240"
        aria-valuemax="420"
        tabindex="0"
        @pointerdown="startResize($event)"
        @keydown.left.prevent="resizeBy(-16)"
        @keydown.right.prevent="resizeBy(16)"
      ></div>
    </aside>

    <main>
      <slot name="header" :left-open="leftOpen" :toggle="toggle" />
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useLeftPanel } from "@components/layout/hooks/use-left-panel.js";

defineSlots<{
  default(): unknown;
  header(props: { leftOpen: boolean; toggle: () => void }): unknown;
  sidebar(props: { onNavigate: () => void; collapsed: boolean; toggle: () => void }): unknown;
}>();

const {
  leftOpen,
  leftWidth,
  isNarrow,
  resizing,
  toggle,
  resizeBy,
  startResize,
  closeMobilePanels,
} = useLeftPanel();
</script>

<style scoped>
.shell {
  --left-width: var(--size-sidebar);
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
  padding: var(--spacing-xs);
  overflow: hidden;
  background: var(--canvas-soft);
  contain: layout style;
  transition: width var(--duration-normal) var(--ease-smooth);
}
.resizer {
  position: absolute;
  inset-block: 0;
  right: 0;
  z-index: var(--z-resizer);
  width: var(--size-resizer);
  cursor: col-resize;
  touch-action: none;
}
.resizer:focus-visible {
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
  contain: strict;
}
main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
}
@media (prefers-reduced-motion: reduce) {
  .sidebar {
    transition: none;
  }
}
@media (min-width: 901px) {
  .shell.left-closed .sidebar {
    width: var(--size-sidebar-rail);
  }
}
html[data-pig-desktop-platform] .sidebar {
  -webkit-app-region: drag;
}
html[data-pig-desktop-platform]
  .sidebar
  :deep(:is(button, a, input, select, textarea, [role="button"], [role="link"])),
html[data-pig-desktop-platform] .resizer {
  -webkit-app-region: no-drag;
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
    padding: var(--spacing-md);
    visibility: hidden;
    transform: translateX(-105%);
    transition:
      transform var(--duration-normal) var(--ease-smooth),
      visibility 0s linear var(--duration-normal);
    background: var(--canvas-soft);
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
  .sidebar {
    transition: none;
    animation: none;
  }
}
</style>
