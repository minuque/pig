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
      <select
        aria-label="当前 Workspace"
        :value="workspace?.id"
        @change="
          selectWorkspace(($event.target as HTMLSelectElement).value);
          loadSessions();
        "
      >
        <option v-for="item in workspaces" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <div class="actions compact-actions">
        <button class="secondary" type="button" @click="showAuthorize = true">授权</button>
        <button class="secondary" type="button" :disabled="!workspace" @click="revokeWorkspace">
          Revoke
        </button>
      </div>

      <section aria-labelledby="sessions-title">
        <div class="section-title">
          <h2 id="sessions-title">Sessions</h2>
          <button
            class="icon-button"
            type="button"
            aria-label="创建 Session"
            :disabled="!workspace || creating"
            @click="createSession"
          >
            ＋
          </button>
        </div>
        <p v-if="loadingSessions" role="status">正在加载 Sessions…</p>
        <div v-else-if="sessionError" class="notice error" role="alert">
          <p>{{ sessionError }}</p>
          <button type="button" @click="loadSessions()">重试</button>
        </div>
        <p v-else-if="workspace && sessions.length === 0" class="notice">
          暂无 Session。使用“创建 Session”开始。
        </p>
        <nav v-else aria-label="Session 列表">
          <RouterLink
            v-for="session in sessions"
            :key="session.id"
            :to="`/sessions/${session.id}`"
            class="session-link"
            @click="closeMobilePanels"
          >
            <span>{{ session.name || `Session ${session.id.slice(0, 8)}` }}</span>
            <small
              ><span aria-hidden="true">{{ session.status === "available" ? "✓" : "!" }}</span>
              {{ session.status === "available" ? "Available" : "Unavailable" }}</small
            >
          </RouterLink>
        </nav>
        <button v-if="nextCursor" class="secondary" type="button" @click="loadSessions(true)">
          加载更多
        </button>
      </section>
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

        <section class="transcript-region" aria-labelledby="transcript-title">
          <h2 id="transcript-title" class="sr-only">Transcript</h2>
          <div ref="transcriptElement" class="transcript" aria-live="off" @scroll="recordScroll">
            <div ref="transcriptContent" class="transcript-content">
              <p v-if="loadingTranscript" role="status">正在加载 Transcript…</p>
              <div v-else-if="transcriptError" class="notice error" role="alert">
                {{ transcriptError }}
              </div>
              <article
                v-for="(entry, index) in transcript"
                :key="`${currentSession.id}:${index}`"
                class="message"
              >
                <strong>{{ typeof entry.role === "string" ? entry.role : "message" }}</strong>
                <MarkdownRender
                  mode="chat"
                  :content="transcriptText(entry)"
                  code-renderer="pre"
                  html-policy="safe"
                  :smooth-streaming="false"
                  :typewriter="false"
                  :fade="false"
                />
              </article>
              <article v-for="run in sessionRuns" :key="run.id" class="message streaming">
                <strong>assistant · {{ run.status }}</strong>
                <button
                  v-if="!terminalStatuses.has(run.status)"
                  type="button"
                  class="secondary"
                  :disabled="cancelling.has(run.id)"
                  @click="cancelRun(run)"
                >
                  {{ cancelling.has(run.id) ? "取消中…" : `Cancel ${run.id.slice(0, 8)}` }}
                </button>
                <MarkdownRender
                  mode="chat"
                  :content="run.output"
                  code-renderer="pre"
                  html-policy="safe"
                  :smooth-streaming="terminalStatuses.has(run.status) ? false : 'auto'"
                  :typewriter="!terminalStatuses.has(run.status)"
                  :fade="false"
                />
              </article>
              <p
                v-if="!loadingTranscript && transcript.length === 0 && sessionRuns.length === 0"
                class="notice"
              >
                暂无消息。
              </p>
            </div>
          </div>
          <button
            v-if="clientState?.hasNewActivity"
            class="jump-latest"
            type="button"
            @click="scrollToLatest"
          >
            跳转到最新
          </button>
        </section>

        <form class="prompt" @submit.prevent="sendPrompt">
          <div class="composer-row">
            <label for="prompt-input">Composer</label>
            <select v-model="profile" aria-label="Execution profile">
              <option
                v-for="item in profiles"
                :key="`${item.model}:${item.thinkingLevel}`"
                :value="item"
              >
                {{ item.model }} · {{ item.thinkingLevel }}
              </option>
            </select>
          </div>
          <textarea id="prompt-input" v-model="prompt" rows="3" required></textarea>
          <p v-if="activeRun" id="active-run-reason">当前 Run：{{ activeRun.status }}</p>
          <div v-if="runError" class="notice error" role="alert">{{ runError }}</div>
          <div class="actions composer-actions">
            <button
              type="submit"
              :disabled="!prompt.trim()"
              :aria-describedby="activeRun ? 'active-run-reason' : undefined"
            >
              发送
            </button>
            <button
              type="button"
              class="secondary"
              :disabled="!sessionRuns.some(({ status }) => status === 'running') || !prompt.trim()"
              @click="steerRun(prompt)"
            >
              Steer
            </button>
          </div>
        </form>
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

    <aside
      class="context-panel"
      :class="{ open: rightOpen }"
      aria-label="Run、Session 与 Gateway context"
    >
      <header>
        <h2>Context</h2>
        <button
          class="icon-button panel-close"
          type="button"
          aria-label="收起 Context"
          @click="rightOpen = false"
        >
          ›
        </button>
      </header>
      <section>
        <p class="eyebrow">RUN</p>
        <h2>{{ activeRun ? `Run ${activeRun.id.slice(0, 8)}` : "No active run" }}</h2>
        <p><strong>Status:</strong> {{ activeRun?.status ?? "Idle" }}</p>
        <p v-if="activeRun" class="mono">{{ activeRun.id }}</p>
      </section>
      <section>
        <p class="eyebrow">SESSION</p>
        <h2>{{ currentSession?.name ?? "No session selected" }}</h2>
        <p><strong>Status:</strong> {{ currentSession?.status ?? "Not selected" }}</p>
        <p v-if="currentSession" class="mono">{{ currentSession.id }}</p>
        <div class="actions compact-actions">
          <button
            class="secondary"
            type="button"
            :disabled="!currentSession"
            @click="renameSession"
          >
            重命名
          </button>
          <button
            class="secondary"
            type="button"
            :disabled="!currentSession"
            @click="deleteSession"
          >
            删除
          </button>
        </div>
      </section>
      <section>
        <p class="eyebrow">GATEWAY</p>
        <h2>{{ startupError || runError ? "Attention required" : "Connected" }}</h2>
        <p>{{ startupError || runError || "Local Gateway event stream is available." }}</p>
      </section>
    </aside>

    <div v-if="showAuthorize" class="modal-backdrop" @click.self="closeAuthorize">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="authorize-title">
        <h2 id="authorize-title">授权 Workspace</h2>
        <p v-if="!previewPath">由本机 Gateway 打开 Windows 文件夹选择器。</p>
        <p v-if="previewPath" class="preview">
          <strong>将授权：</strong><span class="mono">{{ previewPath }}</span>
        </p>
        <div v-if="authorizeError" class="notice error" role="alert">{{ authorizeError }}</div>
        <div class="actions">
          <button type="button" class="secondary" :disabled="authorizing" @click="closeAuthorize">
            取消
          </button>
          <button
            v-if="!previewPath"
            ref="pickerButton"
            type="button"
            :disabled="authorizing"
            @click="previewWorkspace"
          >
            {{ authorizing ? "选择中…" : "选择文件夹" }}
          </button>
          <template v-else>
            <button type="button" class="secondary" :disabled="authorizing" @click="clearPreview">
              重新选择
            </button>
            <button type="button" :disabled="authorizing" @click="confirmWorkspace">
              {{ authorizing ? "授权中…" : "确认并授权" }}
            </button>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { clampPanelWidth, isNearBottom } from "./features/sessions/session-state.js";
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
  pickerButton,
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
  terminalStatuses,
  transcriptText,
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

const narrowViewport = matchMedia("(max-width: 900px)");
const leftOpen = ref(!narrowViewport.matches);
const rightOpen = ref(!narrowViewport.matches);
const leftWidth = ref(280);
const rightWidth = ref(300);
const transcriptElement = ref<HTMLElement>();
const transcriptContent = ref<HTMLElement>();
let switchingSession = false;
let restoreTarget: number | undefined;
const resizeObserver = new ResizeObserver(() => contentChanged());

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
function recordScroll() {
  if (switchingSession || !transcriptElement.value || !clientState.value) return;
  const element = transcriptElement.value;
  clientState.value.scrollTop = element.scrollTop;
  clientState.value.following = isNearBottom(
    element.scrollTop,
    element.clientHeight,
    element.scrollHeight,
  );
  if (clientState.value.following) clientState.value.hasNewActivity = false;
}
async function scrollToLatest() {
  await nextTick();
  if (!transcriptElement.value || !clientState.value) return;
  transcriptElement.value.scrollTop = transcriptElement.value.scrollHeight;
  clientState.value.scrollTop = transcriptElement.value.scrollTop;
  clientState.value.following = true;
  clientState.value.hasNewActivity = false;
}
function restoreScroll() {
  if (restoreTarget === undefined || loadingTranscript.value) return false;
  if (transcriptElement.value && clientState.value) {
    transcriptElement.value.scrollTop = restoreTarget;
    clientState.value.scrollTop = transcriptElement.value.scrollTop;
    clientState.value.following = isNearBottom(
      transcriptElement.value.scrollTop,
      transcriptElement.value.clientHeight,
      transcriptElement.value.scrollHeight,
    );
    clientState.value.hasNewActivity = false;
  }
  restoreTarget = undefined;
  switchingSession = false;
  return true;
}
function contentChanged() {
  if (!clientState.value || restoreScroll()) return;
  if (clientState.value.following) void scrollToLatest();
  else clientState.value.hasNewActivity = true;
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
watch(transcriptContent, (element, previous) => {
  if (previous) resizeObserver.unobserve(previous);
  if (element) resizeObserver.observe(element);
});
watch(
  () => currentSession.value?.id,
  async () => {
    switchingSession = true;
    restoreTarget = clientState.value?.scrollTop ?? 0;
    await nextTick();
    restoreScroll();
  },
  { flush: "pre" },
);
watch(loadingTranscript, async (loading) => {
  if (!loading) {
    await nextTick();
    restoreScroll();
  }
});
onBeforeUnmount(() => {
  resizeObserver.disconnect();
  narrowViewport.removeEventListener("change", handleViewportChange);
  window.removeEventListener("resize", fitPanels);
});
</script>
