<template>
  <header class="workbench-header">
    <button v-if="!leftOpen" class="header-toggle" type="button" title="打开侧边栏" @click="toggle">
      <PanelLeft class="size-icon" />
    </button>
    <div class="header-crumb">
      <h1 v-if="title" id="current-title" class="header-session">{{ title }}</h1>
    </div>
    <div class="header-right">
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { PanelLeft } from "@lucide/vue"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"
import ThemeToggle from "@features/theme/ThemeToggle.vue"

const { leftOpen, toggle } = useLeftPanelToggle()
const { sessionId, projection } = useSession()
const { listedSessions } = useNav()

const title = computed(() =>
  workbenchHeaderTitle({
    sessionId: sessionId.value,
    listed: listedSessions.value,
    projectionName: projection.value?.name,
  }),
)
</script>

<style scoped>
.workbench-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-height: calc(var(--size-control) + 2 * var(--spacing-xs));
  padding: var(--spacing-xxs) var(--spacing-sm);
  background: var(--surface);
}
.workbench-header::after {
  pointer-events: none;
  position: absolute;
  inset-inline: 0;
  top: 100%;
  height: 24px;
  background: linear-gradient(to bottom, var(--surface), transparent);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  mask-image: linear-gradient(to bottom, #000, transparent);
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent);
  content: "";
}

@media (prefers-reduced-transparency: reduce) {
  .workbench-header::after {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    mask-image: none;
    -webkit-mask-image: none;
  }
}

.header-toggle {
  flex: none;
  width: var(--size-icon-button);
  min-height: var(--size-icon-button);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
}

.header-crumb {
  flex: 1 1 auto;
  align-self: stretch;
  min-width: 0;
}

.header-session {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
}

.header-right {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xs);
}

html[data-pig-desktop-platform] .workbench-header,
html[data-pig-desktop-platform] .header-crumb,
html[data-pig-desktop-platform] .header-session {
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .workbench-header {
  min-height: var(--titlebar-inset);
  user-select: none;
}

html[data-pig-desktop-platform]
  .workbench-header
  :deep(:is(button, a, input, select, textarea, [role="button"], [role="link"])) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

html[data-pig-desktop-platform="win32"] .workbench-header {
  padding-inline-end: calc(
    var(--spacing-sm) +
      max(
        var(--size-windows-caption),
        100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)
      )
  );
}

@media (max-width: 520px) {
  .workbench-header > .header-toggle {
    padding-inline: var(--spacing-sm);
  }
}
</style>
