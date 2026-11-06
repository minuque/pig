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

    <div
      v-if="sbState === 'expanded'"
      class="resizer"
      tabindex="0"
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
  background: var(--window-surface);
}

.sidebar {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background);
  border-inline-end: var(--border-width) solid var(--border-soft);
  contain: layout style;
  visibility: hidden;
  width: 0;
  border-inline-end-width: 0;
  transition:
    width var(--duration-normal) var(--ease-smooth),
    border-inline-end-width 0s var(--duration-normal),
    visibility 0s var(--duration-normal);
}

.sidebar.expanded {
  visibility: visible;
  width: var(--left-width);
  border-inline-end-width: var(--border-width);
  transition:
    width var(--duration-normal) var(--ease-smooth),
    border-inline-end-width 0s,
    visibility 0s;
}

/* 把手不占位：贴着侧栏边界浮着，命中区左右各外扩一档 */
.resizer {
  position: relative;
  z-index: var(--z-resizer);
  flex: none;
  align-self: stretch;
  width: 0;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

/* 命中区比视觉边界宽一档，落在两侧内容上 */
.resizer::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline: calc(-1 * var(--space-xxs));
}

.resizer:hover {
  cursor: ew-resize;
}

.resizer::after {
  content: "";
  position: absolute;
  top: 50%;
  inset-inline-start: 50%;
  width: 3px;
  height: 40px;
  border-radius: var(--radius-pill);
  background: var(--scrollbar-color);
  opacity: 0;
  translate: -50% -50%;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

/* 只在悬停/键盘聚焦时露形，拖动时换成强调色 */
.resizer:hover::after,
.resizer:focus-visible::after {
  opacity: 1;
}

.shell.is-resizing .resizer::after {
  opacity: 1;
  background: var(--foreground-secondary);
}

html[data-pig-desktop-platform="darwin"] .resizer {
  /* 把手只在标题条以下生效，顶部条带留给拖窗 */
  margin-block-start: var(--titlebar-inset);
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
  /* 困住栏内 z-index 又不吃掉子树 backdrop-filter：用 z-index:0 而不是 isolation:isolate */
  z-index: 0;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--card);
}

@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .resizer,
  .resizer::after {
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
    width: min(88vw, var(--size-drawer));
    visibility: hidden;
    transform: translateX(-105%);
    transition:
      transform var(--duration-normal) var(--ease-smooth),
      visibility 0s linear var(--duration-normal);
    /* 抽屉浮在内容上，半透明窗口下也保持可读 */
    background: var(--background);
    border-inline-end: 0;
    box-shadow: var(--shadow-drawer);
  }

  .sidebar.expanded {
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
