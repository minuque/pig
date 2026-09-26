<template>
  <header class="workbench-header">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="header-toggle"
          type="button"
          :aria-label="leftOpen ? '折叠侧边栏' : '打开侧边栏'"
          @click="toggle"
        >
          <PanelLeft class="size-icon" />
        </button>
      </TooltipTrigger>

      <TooltipContent>{{ leftOpen ? "折叠侧边栏" : "打开侧边栏" }}</TooltipContent>
    </Tooltip>

    <span v-if="cwdName" class="header-cwd" :title="cwd ?? ''">{{ cwdName }}</span>

    <div class="header-crumb">
      <h1 v-if="title" id="current-title" class="header-session">{{ title }}</h1>
    </div>

    <div class="header-right">
      <SoundToggle />
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { PanelLeft } from "@lucide/vue"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"
import SoundToggle from "@features/click-sound/index.vue"
import ThemeToggle from "@features/theme/index.vue"

const props = defineProps<{
  cwd?: string
}>()
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
const cwdName = computed(() => (props.cwd ? workspaceName(props.cwd) : ""))
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
  border-bottom: var(--border-width) solid var(--border-subtle);
  background: var(--surface);
}

.header-toggle {
  flex: none;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
}

.header-toggle:hover,
.header-toggle:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

.header-cwd {
  flex: none;
  max-width: 14rem;
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-sm);
  background: var(--hover-tint);
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-crumb {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  align-self: stretch;
  min-width: 0;
}

.header-session {
  flex: 1 1 auto;
  min-width: 0;
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
