<template>
  <div
    class="shell"
    :class="{ 'left-closed': !leftOpen, 'right-closed': !rightOpen }"
    :style="{ '--left-width': `${leftWidth}px`, '--right-width': `${rightWidth}px` }"
  >
    <aside class="sidebar" :class="{ open: leftOpen }" aria-label="Workspace 与 Session 导航">
      <header>
        <strong>Workspace</strong>
        <button
          class="icon-button panel-close"
          type="button"
          aria-label="收起 Workspace 导航"
          @click="leftOpen = false"
        >
          ‹
        </button>
      </header>
      <SessionNav
        :workspace="workspace"
        :workspaces="workspaces"
        :sessions="sessions"
        :loading-sessions="loadingSessions"
        :creating="creating"
        :next-cursor="nextCursor"
        :session-error="sessionError"
        @authorize="showAuthorize = true"
        @revoke="revokeWorkspace"
        @select-workspace="onSelectWorkspace"
        @create="createSession"
        @load-more="loadSessions(true)"
        @retry="loadSessions()"
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
      @pointerdown="startResize('left', $event)"
      @keydown.left.prevent="resizeBy('left', -16)"
      @keydown.right.prevent="resizeBy('left', 16)"
    ></div>

    <main>
      <header class="workbench-header">
        <button
          class="secondary"
          type="button"
          :aria-expanded="leftOpen"
          @click="leftOpen = !leftOpen"
        >
          Workspace
        </button>
        <strong>{{
          currentSession?.name ||
          (currentSession ? `Session ${currentSession.id.slice(0, 8)}` : "未选择 Session")
        }}</strong>
        <button
          class="secondary"
          type="button"
          :aria-expanded="rightOpen"
          @click="rightOpen = !rightOpen"
        >
          Context
        </button>
      </header>
      <div v-if="startupError" class="notice error" role="alert">{{ startupError }}</div>
      <section
        v-else-if="currentSession"
        :key="currentSession.id"
        class="workspace-main"
        aria-labelledby="current-title"
      >
        <header class="session-heading">
          <div>
            <p class="eyebrow">CURRENT SESSION</p>
            <h1 id="current-title">
              {{ currentSession.name || `Session ${currentSession.id.slice(0, 8)}` }}
            </h1>
          </div>
          <p class="session-status">
            <span class="status-mark" aria-hidden="true">{{
              currentSession.status === "available" ? "✓" : "!"
            }}</span>
            {{ currentSession.status === "available" ? "Available" : "Unavailable" }}
          </p>
        </header>

        <TranscriptView
          :session-id="currentSession.id"
          :transcript="transcript"
          :loading-transcript="loadingTranscript"
          :transcript-error="transcriptError"
          :session-runs="sessionRuns"
          :cancelling="cancelling"
          :client-state="clientState"
          @cancel-run="cancelRun"
        />

        <ComposerBar
          v-model:prompt="prompt"
          v-model:profile="profile"
          :active-run="activeRun"
          :queued-count="queuedCount"
          :cancelling="cancelling"
          :profiles="profiles"
          :unavailable="unavailable"
          :run-error="runError"
          @send="sendPrompt"
          @steer="steerRun(prompt)"
          @cancel-run="cancelRun"
        />
      </section>
      <section v-else class="empty" aria-labelledby="empty-title">
        <h1 id="empty-title">选择或创建 Session</h1>
        <p>从 Workspace 导航选择 Session。</p>
      </section>
    </main>

    <div
      v-if="rightOpen"
      class="resizer right-resizer"
      role="separator"
      aria-label="调整右栏宽度"
      aria-orientation="vertical"
      :aria-valuenow="rightWidth"
      aria-valuemin="240"
      aria-valuemax="420"
      tabindex="0"
      @pointerdown="startResize('right', $event)"
      @keydown.left.prevent="resizeBy('right', 16)"
      @keydown.right.prevent="resizeBy('right', -16)"
    ></div>

    <ContextPanel
      :open="rightOpen"
      :active-run="activeRun"
      :current-session="currentSession"
      :startup-error="startupError"
      :run-error="runError"
      @close="rightOpen = false"
      @rename-session="renameSession"
      @delete-session="deleteSession"
    />

    <WorkspaceAuthorizeDialog
      :show="showAuthorize"
      :preview-path="previewPath"
      :authorizing="authorizing"
      :authorize-error="authorizeError"
      @close="closeAuthorize"
      @preview="previewWorkspace"
      @clear="clearPreview"
      @confirm="confirmWorkspace"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { clampPanelWidth } from "../features/sessions/session-state.js";
import SessionNav from "../features/sessions/SessionNav.vue";
import TranscriptView from "../features/sessions/TranscriptView.vue";
import ComposerBar from "../features/runs/ComposerBar.vue";
import ContextPanel from "../features/runs/ContextPanel.vue";
import WorkspaceAuthorizeDialog from "../features/workspaces/WorkspaceAuthorizeDialog.vue";
import { useApp } from "./use-app.js";

const {
  workspace,
  workspaces,
  sessions,
  loadingSessions,
  creating,
  nextCursor,
  sessionError,
  startupError,
  showAuthorize,
  previewPath,
  authorizing,
  authorizeError,
  currentSession,
  transcript,
  loadingTranscript,
  transcriptError,
  prompt,
  runError,
  cancelling,
  sessionRuns,
  activeRun,
  clientState,
  profiles,
  profile,
  loadSessions,
  sendPrompt,
  cancelRun,
  steerRun,
  clearPreview,
  closeAuthorize,
  previewWorkspace,
  confirmWorkspace,
  createSession,
  renameSession,
  deleteSession,
  revokeWorkspace,
  selectWorkspace,
} = useApp();

const unavailable = computed(() => currentSession.value?.status === "unavailable");
const queuedCount = computed(
  () => sessionRuns.value.filter(({ status }) => status === "queued").length,
);
function onSelectWorkspace(id: string) {
  selectWorkspace(id);
  void loadSessions();
}

/* ── 面板布局（resize + 移动端抽屉） ──────────────────────────────── */
const narrowViewport = matchMedia("(max-width: 900px)");
const leftOpen = ref(!narrowViewport.matches);
const rightOpen = ref(!narrowViewport.matches);
const leftWidth = ref(280);
const rightWidth = ref(300);

function setPanelWidth(side: "left" | "right", desired: number) {
  const otherWidth = side === "left" ? rightWidth.value : leftWidth.value;
  const otherOpen = side === "left" ? rightOpen.value : leftOpen.value;
  const room = window.innerWidth - (otherOpen ? otherWidth + 6 : 0) - 326;
  (side === "left" ? leftWidth : rightWidth).value = Math.min(
    clampPanelWidth(desired),
    Math.max(240, room),
  );
}
function resizeBy(side: "left" | "right", delta: number) {
  const width = side === "left" ? leftWidth.value : rightWidth.value;
  setPanelWidth(side, width + delta);
}
function startResize(side: "left" | "right", event: PointerEvent) {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = side === "left" ? leftWidth.value : rightWidth.value;
  const move = (next: PointerEvent) => {
    const delta = (next.clientX - startX) * (side === "left" ? 1 : -1);
    setPanelWidth(side, startWidth + delta);
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop, { once: true });
}
function closeMobilePanels() {
  if (narrowViewport.matches) {
    leftOpen.value = false;
    rightOpen.value = false;
  }
}
function fitPanels() {
  if (narrowViewport.matches || !leftOpen.value || !rightOpen.value) return;
  const excess = leftWidth.value + rightWidth.value - (window.innerWidth - 332);
  if (excess <= 0) return;
  rightWidth.value = Math.max(240, rightWidth.value - excess);
  leftWidth.value = Math.max(
    240,
    Math.min(leftWidth.value, window.innerWidth - 332 - rightWidth.value),
  );
}
function handleViewportChange(event: MediaQueryListEvent) {
  if (event.matches) closeMobilePanels();
  else fitPanels();
}
narrowViewport.addEventListener("change", handleViewportChange);
window.addEventListener("resize", fitPanels);
fitPanels();
watch([leftOpen, rightOpen], async () => {
  await nextTick();
  fitPanels();
});
onBeforeUnmount(() => {
  narrowViewport.removeEventListener("change", handleViewportChange);
  window.removeEventListener("resize", fitPanels);
});
</script>
