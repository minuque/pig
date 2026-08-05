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
          @click="leftOpen = !leftOpen"
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
          :client-state="clientState"
          @cancel-run="cancelRun"
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import ChatInput from "../features/runs/ChatInput.vue";
import { clampPanelWidth } from "../features/sessions/session-state.js";
import SessionNav from "../features/sessions/SessionNav.vue";
import SessionWelcome from "../features/sessions/SessionWelcome.vue";
import ThemeToggle from "../features/theme/ThemeToggle.vue";
import TranscriptView from "../features/sessions/TranscriptView.vue";
import WorkspaceAuthorizeDialog from "../features/workspaces/WorkspaceAuthorizeDialog.vue";
import { useApp } from "./use-app.js";

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

/* ── 欢迎页：创建 Session 后立即发送首个 Run ───────────────────── */
const welcomePrompt = ref("");
const welcomeWorkspaceId = ref<string>();
const welcomeSubmitting = ref(false);
const welcomeError = ref("");

watch(
  workspaces,
  (items) => {
    if (!items.some(({ id }) => id === welcomeWorkspaceId.value))
      welcomeWorkspaceId.value = items[0]?.id;
  },
  { immediate: true },
);
async function submitWelcome(text: string) {
  const workspaceId = welcomeWorkspaceId.value;
  const trimmed = text.trim();
  if (!workspaceId || !preset.value || !trimmed || welcomeSubmitting.value) return;
  welcomeSubmitting.value = true;
  welcomeError.value = "";
  try {
    const session = await createSession(workspaceId);
    if (!session) {
      welcomeError.value = sessionErrors.value.get(workspaceId) || "无法创建 Session";
      return;
    }
    await nextTick();
    prompt.value = trimmed;
    await sendPrompt();
    welcomePrompt.value = "";
  } finally {
    welcomeSubmitting.value = false;
  }
}

/* ── 左栏布局（resize + 移动端抽屉） ─────────────────────────────── */
const narrowViewport = matchMedia("(max-width: 900px)");
const leftOpen = ref(!narrowViewport.matches);
const leftWidth = ref(clampPanelWidth(window.innerWidth * 0.18));

function setPanelWidth(desired: number) {
  const room = window.innerWidth - 332;
  leftWidth.value = Math.min(clampPanelWidth(desired), Math.max(240, room));
}
function resizeBy(delta: number) {
  setPanelWidth(leftWidth.value + delta);
}
function startResize(event: PointerEvent) {
  event.preventDefault();
  const startX = event.clientX;
  const startWidth = leftWidth.value;
  const move = (next: PointerEvent) => setPanelWidth(startWidth + (next.clientX - startX));
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop, { once: true });
}
function closeMobilePanels() {
  if (narrowViewport.matches) leftOpen.value = false;
}
function fitPanels() {
  if (narrowViewport.matches || !leftOpen.value) return;
  const excess = leftWidth.value - (window.innerWidth - 332);
  if (excess > 0) leftWidth.value = Math.max(240, leftWidth.value - excess);
}
function handleViewportChange(event: MediaQueryListEvent) {
  if (event.matches) closeMobilePanels();
  else fitPanels();
}
narrowViewport.addEventListener("change", handleViewportChange);
window.addEventListener("resize", fitPanels);
fitPanels();
watch(leftOpen, () => void fitPanels());
onBeforeUnmount(() => {
  narrowViewport.removeEventListener("change", handleViewportChange);
  window.removeEventListener("resize", fitPanels);
});
</script>
