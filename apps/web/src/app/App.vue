<template>
  <div
    class="shell"
    :class="{ 'left-closed': !leftOpen }"
    :style="{ '--left-width': `${leftWidth}px` }"
  >
    <aside class="sidebar" :class="{ open: leftOpen }" aria-label="Workspace 与 Session 导航">
      <SessionNav
        :groups="groups"
        :workspaces="workspaces"
        :expanded-workspace-ids="expandedWorkspaceIds"
        :active-workspace-id="activeWorkspaceId"
        :active-session-id="activeSessionId"
        :active-session-running="activeSessionRunning"
        :creating="Boolean(creating)"
        :adding-workspace="addingWorkspace"
        :workspace-error="sessionError"
        @toggle-workspace="toggleWorkspace"
        @add-workspace="addWorkspace"
        @revoke="revokeWorkspace"
        @create="createSession"
        @navigate="closeMobilePanels"
      />
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
        <h1 id="current-title">{{ currentTitle }}</h1>
        <div class="header-right">
          <p v-if="projection" class="session-status">
            <span
              class="status-mark"
              :style="{ color: projection.running ? 'var(--primary)' : 'var(--ink-faint)' }"
              aria-hidden="true"
              >●</span
            >
            {{ phaseLabel(projection.phase) }}
          </p>
          <ThemeToggle />
        </div>
      </header>

      <div v-if="startupError" class="notice error startup-error" role="alert">
        {{ startupError }}
      </div>
      <p v-else-if="connecting" class="notice startup-error" role="status">正在连接本地服务…</p>
      <p v-else-if="connectionError && connected" class="notice error startup-error" role="alert">
        {{ connectionError.message }}
      </p>
      <section
        v-else-if="sessionId"
        :key="sessionId"
        class="workspace-main enter-blur"
        aria-labelledby="current-title"
      >
        <TranscriptView
          :session-id="sessionId"
          :transcript="transcript"
          :phase="phase"
          :aborting="aborting"
          :scroll-top="clientState?.scrollTop ?? 0"
          :following="clientState?.following ?? true"
          :has-new-activity="clientState?.hasNewActivity ?? false"
          @abort="abortSession"
          @scroll-state="applyScrollState"
        />

        <ChatInput
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="catalog"
          :phase="phase"
          :queued-steer-count="queuedSteerCount"
          :aborting="aborting"
          :error="sessionError"
          @send="submitText"
          @abort="abortSession"
        />
      </section>
      <SessionWelcome
        v-else
        v-model:prompt="welcomePrompt"
        v-model:preset="preset"
        v-model:workspace-id="welcomeWorkspaceId"
        :workspaces="workspaces"
        :catalog="catalog"
        :submitting="welcomeSubmitting"
        :error="welcomeError"
        @submit="submitWelcome"
        @add-workspace="addWorkspace"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PanelLeft } from "lucide-vue-next";
import ChatInput from "../components/composer/ChatInput.vue";
import SessionNav from "../features/sessions/SessionNav.vue";
import SessionWelcome from "../features/sessions/SessionWelcome.vue";
import { phaseLabel } from "../features/sessions/SessionControlBar.vue";
import ThemeToggle from "../features/theme/ThemeToggle.vue";
import TranscriptView from "../features/sessions/TranscriptView.vue";
import { useApp } from "./use-app.js";
import { useLeftPanel } from "./use-left-panel.js";
import { useWelcomeSubmit } from "./use-welcome-submit.js";

const {
  startupError,
  sessionError,
  aborting,
  creating,
  addingWorkspace,
  preset,
  prompt,
  catalog,
  connected,
  connecting,
  connectionError,
  groups,
  workspaces,
  expandedWorkspaceIds,
  activeWorkspaceId,
  activeSessionId,
  activeSessionRunning,
  sessionId,
  projection,
  phase,
  queuedSteerCount,
  transcript,
  clientState,
  toggleWorkspace,
  addWorkspace,
  revokeWorkspace,
  createSession,
  submitText,
  abortSession,
  applyScrollState,
  lastCwd,
} = useApp();

const currentTitle = computed(
  () => projection.value?.name ?? (sessionId.value ? "Session" : "新建 Session"),
);

/* ── 布局与欢迎页编排由职责聚焦的 composable 提供 ───────────────── */
const { leftOpen, leftWidth, toggle, resizeBy, startResize, closeMobilePanels } = useLeftPanel();
const { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, welcomeError, submitWelcome } =
  useWelcomeSubmit({
    workspaces,
    lastCwd,
    preset,
    createSession,
    submit: submitText,
  });
</script>

<style scoped>
/* ── 工作台壳布局（原 app.css，随入口组件共置） ─────────────────── */
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
.startup-error {
  margin: var(--spacing-md);
}
.workspace-main {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}
.enter-blur {
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .shell {
    transition: none;
  }
  .enter-blur {
    animation: none;
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
  .workspace-main {
    padding: var(--spacing-sm);
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
  .workspace-main {
    gap: var(--spacing-xs);
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
