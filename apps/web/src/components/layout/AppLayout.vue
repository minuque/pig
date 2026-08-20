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
      <header class="workbench-header">
        <button
          class="icon-button header-toggle"
          type="button"
          :aria-expanded="leftOpen"
          aria-label="切换工作目录导航"
          @click="toggle"
        >
          <PanelLeft :size="16" aria-hidden="true" />
        </button>
        <h1 v-if="title" id="current-title">{{ title }}</h1>
        <span v-if="thinkingLevel" class="header-chip">{{ thinkingLevel }}</span>
        <div class="header-right">
          <p v-if="connecting && !phase" class="session-status" role="status">正在连接…</p>
          <p v-else-if="phase && phase !== 'idle'" class="session-status" role="status">
            <span
              class="status-mark"
              :style="{ color: running ? 'var(--primary)' : 'var(--ink-faint)' }"
              aria-hidden="true"
              >●</span
            >
            {{ phaseLabel(phase) }}
          </p>
          <ThemeToggle />
        </div>
      </header>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import type { SessionPhase } from "@earendil-works/pi-protocol";
import { PanelLeft } from "lucide-vue-next";
import { phaseLabel } from "@features/session-workbench/components/SessionControlBar.vue";
import ThemeToggle from "@features/theme/ThemeToggle.vue";
import { useLeftPanel } from "@components/layout/hooks/use-left-panel.js";

defineProps<{
  title: string;
  phase?: SessionPhase | undefined;
  running?: boolean | undefined;
  connecting?: boolean | undefined;
  thinkingLevel?: string | undefined;
}>();

defineSlots<{
  default(): unknown;
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
.workbench-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: calc(var(--size-control) + 2 * var(--spacing-xs));
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--surface);
}
.header-toggle {
  flex: none;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
}
.workbench-header h1 {
  min-width: 0;
  max-width: 40vw;
  margin: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-chip {
  flex: none;
  max-width: 8rem;
  padding: 2px 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}
.header-right {
  display: flex;
  align-items: center;
  margin-left: auto;
  gap: var(--spacing-xs);
}
.header-right .session-status {
  margin: 0;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}
.status-mark {
  font-size: var(--text-eyebrow);
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
  .header-toggle {
    display: none;
  }
}
html[data-pig-desktop-platform] .sidebar,
html[data-pig-desktop-platform] .workbench-header {
  -webkit-app-region: drag;
}
html[data-pig-desktop-platform]
  .sidebar
  :deep(:is(button, a, input, select, textarea, [role="button"], [role="link"])),
html[data-pig-desktop-platform]
  .workbench-header
  :deep(:is(button, a, input, select, textarea, [role="button"], [role="link"])),
html[data-pig-desktop-platform] .resizer {
  -webkit-app-region: no-drag;
}
html[data-pig-desktop-platform="win32"] .workbench-header {
  min-height: var(--titlebar-inset);
  padding-right: var(--size-windows-caption);
}
html[data-pig-desktop-platform="darwin"] .shell,
html[data-pig-desktop-platform="win32"] .shell {
  background: transparent;
}
html[data-pig-desktop-platform="darwin"] .sidebar,
html[data-pig-desktop-platform="win32"] .sidebar {
  background: color-mix(in srgb, var(--canvas-soft) 72%, transparent);
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
@media (max-width: 520px) {
  .header-right .session-status {
    width: var(--size-control);
    overflow: hidden;
    font-size: 0;
    text-align: center;
  }
  .workbench-header .status-mark {
    font-size: var(--text-eyebrow);
  }
  .workbench-header > .header-toggle {
    padding-inline: var(--spacing-sm);
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
