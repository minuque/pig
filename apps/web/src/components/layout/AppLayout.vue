<template>
  <div
    class="shell"
    :class="{ 'left-closed': !leftOpen }"
    :style="{ '--left-width': `${leftWidth}px` }"
  >
    <aside class="sidebar" :class="{ open: leftOpen }" aria-label="Workspace 与 Session 导航">
      <slot name="sidebar" :on-navigate="closeMobilePanels" />
    </aside>

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

    <main>
      <header class="workbench-header">
        <button
          class="icon-button header-toggle"
          type="button"
          :aria-expanded="leftOpen"
          aria-label="切换 Workspace 导航"
          @click="toggle"
        >
          <PanelLeft :size="16" aria-hidden="true" />
        </button>
        <h1 id="current-title">{{ title }}</h1>
        <div class="header-right">
          <p v-if="phase" class="session-status">
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
import { phaseLabel } from "@features/sessions/SessionControlBar.vue";
import ThemeToggle from "@features/theme/ThemeToggle.vue";
import { useLeftPanel } from "@components/layout/hooks/use-left-panel.js";

defineProps<{
  title: string;
  phase?: SessionPhase | undefined;
  running?: boolean | undefined;
}>();

defineSlots<{
  default(): unknown;
  sidebar(props: { onNavigate: () => void }): unknown;
}>();

const { leftOpen, leftWidth, toggle, resizeBy, startResize, closeMobilePanels } = useLeftPanel();
</script>

<style scoped>
.shell {
  --left-width: var(--size-sidebar);
  height: 100vh;
  display: grid;
  grid-template-columns: var(--left-width) var(--size-resizer) minmax(0, 1fr);
  padding: var(--spacing-xs);
  overflow: hidden;
  transition: grid-template-columns var(--duration-normal) var(--ease-smooth);
}
.shell.left-closed {
  grid-template-columns: 0 0 minmax(0, 1fr);
}
.sidebar {
  min-width: 0;
  padding: var(--spacing-xs);
  overflow: auto;
  background: transparent;
}
.left-closed .sidebar {
  visibility: hidden;
  padding: 0;
}
.resizer {
  z-index: var(--z-resizer);
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}
.resizer:hover,
.resizer:focus-visible {
  background: var(--hairline);
}
main {
  grid-column: 3;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-shell);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.workbench-header {
  display: grid;
  grid-template-columns: minmax(7.5rem, 1fr) auto minmax(7.5rem, 1fr);
  align-items: center;
  min-height: calc(var(--size-control) + 2 * var(--spacing-xs));
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--surface);
}
.header-toggle {
  justify-self: start;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
}
.workbench-header h1 {
  justify-self: center;
  min-width: 0;
  max-width: 50vw;
  margin: 0;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-right {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: var(--spacing-xs);
}
.header-right .session-status {
  margin: 0;
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
}
.status-mark {
  font-size: var(--text-eyebrow);
}
@media (prefers-reduced-motion: reduce) {
  .shell {
    transition: none;
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
    border-radius: 0;
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
  .workbench-header {
    grid-template-columns: var(--size-control) minmax(0, 1fr) auto;
  }
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
