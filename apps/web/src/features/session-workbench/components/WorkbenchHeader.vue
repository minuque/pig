<template>
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
    <h1
      v-if="title"
      id="current-title"
      class="header-crumb"
      :title="cwd ? `${cwd} \\ ${title}` : title"
    >
      <template v-if="dirName">
        <span class="mark" aria-hidden="true">
          <Folder :size="16" :stroke-width="1.5" />
        </span>
        <span class="header-dir">{{ dirName }}</span>
        <span class="header-sep" aria-hidden="true">\</span>
      </template>
      <span class="header-session">{{ title }}</span>
    </h1>
    <div class="header-right">
      <p v-if="connecting && !projection" class="session-status" role="status">正在连接…</p>
      <p v-else-if="sessionPending" class="session-status" role="status">正在加载会话…</p>
      <p v-else-if="phaseText" class="session-status" role="status">
        <span
          class="status-mark"
          :style="{ color: running ? 'var(--primary)' : 'var(--ink-faint)' }"
          aria-hidden="true"
          >●</span
        >
        {{ phaseText }}
      </p>
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Folder, PanelLeft } from "lucide-vue-next"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import { workspaceName } from "@features/session-nav/format.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"
import ThemeToggle from "@features/theme/ThemeToggle.vue"

const { leftOpen, toggle } = useLeftPanelToggle()
const { sessionId, projection, connecting, sessionPending, composerCwd, running, phaseText } =
  useSession()
const { listedSessions } = useNav()

const title = computed(() =>
  workbenchHeaderTitle({
    sessionId: sessionId.value,
    listed: listedSessions.value,
    projectionName: projection.value?.name,
  }),
)
const cwd = computed(() => (sessionId.value ? composerCwd.value : undefined))
const dirName = computed(() => (cwd.value ? workspaceName(cwd.value) : ""))
</script>

<style scoped>
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
  color: var(--ink-muted);
}
.header-crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 60vw;
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
}
.mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.header-dir,
.header-session {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-dir {
  flex: none;
  max-width: 40%;
}
.header-sep {
  flex: none;
}
.header-session {
  flex: 1;
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
@media (min-width: 901px) {
  .header-toggle {
    display: none;
  }
}
html[data-pig-desktop-platform] .workbench-header {
  -webkit-app-region: drag;
}
html[data-pig-desktop-platform]
  .workbench-header
  :deep(:is(button, a, input, select, textarea, [role="button"], [role="link"])) {
  -webkit-app-region: no-drag;
}
html[data-pig-desktop-platform="win32"] .workbench-header {
  min-height: var(--titlebar-inset);
  padding-right: var(--size-windows-caption);
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
</style>
