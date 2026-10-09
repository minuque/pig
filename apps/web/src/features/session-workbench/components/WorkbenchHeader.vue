<template>
  <header class="workbench-header">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="header-toggle"
          :class="{ 'is-stowed': leftOpen }"
          type="button"
          :inert="leftOpen"
          :aria-label="t('nav.openSidebar')"
          @click="toggle"
        >
          <SidebarGlyph :open="leftOpen" />
        </button>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.openSidebar") }}</TooltipContent>
    </Tooltip>

    <span v-if="cwdName" class="header-cwd" :title="cwd ?? ''">{{ cwdName }}</span>

    <SessionTabStrip
      v-if="tabs.length > 0"
      :tabs="tabs"
      :active-id="highlightedSessionId"
      :state-of="stateOf"
      :pinned="pinned"
      :vendor-of="vendorOf"
      @select="openSession"
      @move="moveTab"
      @close="closeTab"
      @close-scope="closeScope"
      @rename="onRename"
      @toggle-pinned="togglePinned"
      @delete="deleteSession"
    />

    <h1 v-else-if="title" id="current-title" class="header-session">{{ title }}</h1>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { sessionTitle, useNav, workspaceName } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import { useSessionTabs } from "@features/session-workbench/hooks/use-session-tabs.js"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"
import type { SidebarSessionState } from "@features/session-nav/type.js"
import SessionTabStrip from "@features/session-workbench/components/SessionTabStrip.vue"
import { SidebarGlyph } from "@components/icons/index.js"

const props = defineProps<{
  cwd?: string | undefined
}>()
const { t } = useI18n()
const { leftOpen, toggle } = useLeftPanelToggle()
const { sessionId, projection } = useSession()
const {
  listedSessions,
  cardFootById,
  pinnedIds,
  highlightedSessionId,
  openSession,
  togglePinned,
  renameSession,
  deleteSession,
} = useNav()
const sessions = computed(() =>
  listedSessions.value.map((session) => ({ id: session.id, title: sessionTitle(session) })),
)
const { tabs, moveTab, closeTab, closeScope } = useSessionTabs({
  activeSessionId: highlightedSessionId,
  sessions,
  open: openSession,
})
const title = computed(() =>
  workbenchHeaderTitle({
    sessionId: sessionId.value,
    listed: listedSessions.value,
    projectionName: projection.value?.name,
  }),
)
const cwdName = computed(() => (props.cwd ? workspaceName(props.cwd) : ""))

function stateOf(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function pinned(id: string): boolean {
  return pinnedIds.value.has(id)
}

/** 会话默认模型的厂商标，用于页签左侧图标。 */
function vendorOf(id: string): string | undefined {
  return cardFootById.value.get(id)?.model?.provider
}

function onRename(id: string, name: string): void {
  void renameSession(id, name)
}
</script>

<style scoped>
.workbench-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-height: calc(var(--size-nav-rail) + 2 * var(--spacing-sm));
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--border-subtle);
  background: var(--surface);
}

.header-toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  transition:
    width var(--duration-slow) var(--ease-smooth),
    margin var(--duration-slow) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-out);
}

/* 侧栏展开时收起入口：宽度归零并抵消 gap，图标同步形变 */
.header-toggle.is-stowed {
  width: 0;
  margin-inline-end: calc(-1 * var(--spacing-xs));
  opacity: 0;
  pointer-events: none;
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

html[data-pig-desktop-platform] .workbench-header,
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
  :deep(:is(button, a, input, select, textarea, [role="tab"], [role="button"], [role="link"])) {
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
  .workbench-header > .header-toggle:not(.is-stowed) {
    width: calc(var(--size-nav-rail) + var(--spacing-xs));
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-toggle {
    transition: none;
  }
}
</style>
