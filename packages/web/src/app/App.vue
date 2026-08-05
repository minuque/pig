<template>
  <div
    class="shell"
    :class="{ 'left-closed': !leftOpen }"
    :style="{ '--left-width': `${leftWidth}px` }"
  >
    <aside class="sidebar" :class="{ open: leftOpen }" aria-label="Workspace 与 Session 导航">
      <SessionNav
        :workspaces="workspaces"
        :active-workspace-id="workspace?.id"
        :expanded-workspace-ids="expandedWorkspaceIds"
        :sessions-by-workspace="sessionsByWorkspace"
        :loading-workspace-ids="loadingWorkspaceIds"
        :session-errors="sessionErrors"
        :next-cursors="nextCursors"
        :active-session-id="currentSession?.id"
        :active-session-has-run="Boolean(activeRun)"
        :creating-workspace-id="creatingWorkspaceId"
        @toggle-workspace="toggleWorkspace"
        @authorize="showAuthorize = true"
        @revoke="revokeWorkspace"
        @create="createSession"
        @load-more="loadSessions($event, true)"
        @retry="loadSessions"
        @navigate="closeMobilePanels"
        @rename="renameSession"
        @delete="deleteSession"
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
        <h1 id="current-title">
          {{
            currentSession?.name ||
            (currentSession ? `Session ${currentSession.id.slice(0, 8)}` : "新建 Session")
          }}
        </h1>
        <div class="header-right">
          <p v-if="currentSession" class="session-status">
            <span class="status-mark" aria-hidden="true">{{
              currentSession.status === "available" ? "●" : "!"
            }}</span>
            {{ currentSession.status === "available" ? "Available" : "Unavailable" }}
          </p>
          <ThemeToggle />
        </div>
      </header>

      <div v-if="startupError" class="notice error startup-error" role="alert">
        {{ startupError }}
      </div>
      <section
        v-else-if="currentSession"
        :key="`${currentSession.workspaceId}:${currentSession.id}`"
        class="workspace-main enter-blur"
        aria-labelledby="current-title"
      >
        <TranscriptView
          :session-id="currentSession.id"
          :transcript="transcript"
          :loading-transcript="loadingTranscript"
          :transcript-error="transcriptError"
          :session-runs="sessionRuns"
          :cancelling="cancelling"
          :scroll-top="clientState?.scrollTop ?? 0"
          :following="clientState?.following ?? true"
          :has-new-activity="clientState?.hasNewActivity ?? false"
          @cancel-run="cancelRun"
          @scroll-state="applyScrollState"
        />

        <ChatInput
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="catalog"
          :active-run="activeRun"
          :queued-count="queuedCount"
          :cancelling="cancelling"
          :unavailable="unavailable"
          :run-error="runError"
          @send="sendPrompt"
          @steer="steerRun"
          @cancel-run="cancelRun"
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
        @authorize="showAuthorize = true"
      />
    </main>

    <WorkspaceAuthorizeDialog
      :show="showAuthorize"
      :preview-path="previewPath"
      :authorizing="authorizing"
      :authorize-error="authorizeError"
      :candidates="workspaceCandidates"
      :candidates-loading="candidatesLoading"
      :candidates-error="candidatesError"
      @close="closeAuthorize"
      @preview="previewWorkspace"
      @clear="clearPreview"
      @confirm="confirmWorkspace"
      @select-candidate="selectCandidate"
    />
  </div>
</template>

<script setup lang="ts">
import { PanelLeft } from "lucide-vue-next";
import { computed } from "vue";
import ChatInput from "../features/runs/ChatInput.vue";
import SessionNav from "../features/sessions/SessionNav.vue";
import SessionWelcome from "../features/sessions/SessionWelcome.vue";
import ThemeToggle from "../features/theme/ThemeToggle.vue";
import TranscriptView from "../features/sessions/TranscriptView.vue";
import WorkspaceAuthorizeDialog from "../features/workspaces/WorkspaceAuthorizeDialog.vue";
import { useApp } from "./use-app.js";
import { useLeftPanel } from "./use-left-panel.js";
import { useWelcomeSubmit } from "./use-welcome-submit.js";

const {
  workspace,
  workspaces,
  sessionsByWorkspace,
  loadingWorkspaceIds,
  creatingWorkspaceId,
  sessionErrors,
  nextCursors,
  expandedWorkspaceIds,
  toggleWorkspace,
  startupError,
  showAuthorize,
  previewPath,
  authorizing,
  authorizeError,
  workspaceCandidates,
  candidatesLoading,
  candidatesError,
  currentSession,
  transcript,
  loadingTranscript,
  transcriptError,
  prompt,
  runError,
  cancelling,
  sessionRuns,
  activeRun,
  applyScrollState,
  clientState,
  catalog,
  preset,
  loadSessions,
  sendPrompt,
  cancelRun,
  steerRun,
  clearPreview,
  closeAuthorize,
  previewWorkspace,
  selectCandidate,
  confirmWorkspace,
  createSession,
  renameSession,
  deleteSession,
  revokeWorkspace,
} = useApp();

const unavailable = computed(() => currentSession.value?.status === "unavailable");
const queuedCount = computed(
  () => sessionRuns.value.filter(({ status }) => status === "queued").length,
);

/* ── 布局与欢迎页编排由职责聚焦的 composable 提供 ───────────────── */
const { leftOpen, leftWidth, toggle, resizeBy, startResize, closeMobilePanels } = useLeftPanel();
const { welcomePrompt, welcomeWorkspaceId, welcomeSubmitting, welcomeError, submitWelcome } =
  useWelcomeSubmit({ workspaces, preset, sessionErrors, prompt, createSession, sendPrompt });
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
  color: var(--success);
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
