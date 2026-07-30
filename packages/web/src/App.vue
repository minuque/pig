<template>
  <div class="shell">
    <aside class="sidebar" :class="{ open: navOpen }">
      <header>
        <strong>{{ workspace?.name ?? "Workspace" }}</strong>
        <button class="secondary" type="button" @click="showAuthorize = true">授权目录</button>
      </header>

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
          <button type="button" @click="loadSessions">重试</button>
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
            @click="navOpen = false"
          >
            <span>{{ session.name || `Session ${session.id.slice(0, 8)}` }}</span>
            <small
              ><span aria-hidden="true">{{ session.status === "available" ? "✓" : "!" }}</span>
              {{ session.status === "available" ? "Available" : "Unavailable" }}</small
            >
          </RouterLink>
        </nav>
      </section>
    </aside>

    <main>
      <header class="mobile-header">
        <button
          type="button"
          class="secondary"
          aria-label="打开 Session 导航"
          @click="navOpen = !navOpen"
        >
          Sessions
        </button>
        <strong>{{
          currentSession?.name ||
          (currentSession ? `Session ${currentSession.id.slice(0, 8)}` : "未选择 Session")
        }}</strong>
      </header>
      <div v-if="startupError" class="notice error" role="alert">{{ startupError }}</div>
      <section v-else-if="currentSession" class="content" aria-labelledby="current-title">
        <p class="eyebrow">CURRENT SESSION</p>
        <h1 id="current-title">
          {{ currentSession.name || `Session ${currentSession.id.slice(0, 8)}` }}
        </h1>
        <p>
          <span class="status-mark" aria-hidden="true">{{
            currentSession.status === "available" ? "✓" : "!"
          }}</span>
          {{ currentSession.status === "available" ? "Available" : "Unavailable" }}
        </p>
        <p class="mono">Session ID: {{ currentSession.id }}</p>
        <section class="transcript" aria-labelledby="transcript-title" aria-live="off">
          <h2 id="transcript-title">Transcript</h2>
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
        </section>
        <form class="prompt" @submit.prevent="sendPrompt">
          <label for="prompt-input">Prompt</label>
          <textarea
            id="prompt-input"
            v-model="prompt"
            rows="4"
            :disabled="Boolean(activeRun)"
            required
          ></textarea>
          <p v-if="activeRun" id="active-run-reason">
            已有 active Run（{{ activeRun.status }}），完成或取消后才能发送。
          </p>
          <div v-if="runError" class="notice error" role="alert">{{ runError }}</div>
          <div class="actions">
            <button
              type="submit"
              :disabled="!prompt.trim() || Boolean(activeRun)"
              :aria-describedby="activeRun ? 'active-run-reason' : undefined"
            >
              发送
            </button>
            <button
              type="button"
              class="secondary"
              :disabled="!activeRun || cancelling"
              @click="cancelRun"
            >
              {{ cancelling ? "取消中…" : "Cancel" }}
            </button>
          </div>
        </form>
      </section>
      <section v-else class="content empty" aria-labelledby="empty-title">
        <h1 id="empty-title">选择或创建 Session</h1>
        <p>当前 Session 页面会显示稳定的 Session ID 与可用状态。</p>
      </section>
    </main>

    <div v-if="showAuthorize" class="modal-backdrop" @click.self="closeAuthorize">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="authorize-title">
        <h2 id="authorize-title">授权 Workspace</h2>
        <label for="workspace-path">目录路径</label>
        <input
          id="workspace-path"
          ref="pathInput"
          v-model="candidatePath"
          :disabled="authorizing"
          @input="clearPreview"
        />
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
            type="button"
            :disabled="!candidatePath.trim() || authorizing"
            @click="previewWorkspace"
          >
            {{ authorizing ? "预览中…" : "预览路径" }}
          </button>
          <button v-else type="button" :disabled="authorizing" @click="confirmWorkspace">
            {{ authorizing ? "授权中…" : "确认并授权" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SSEEventEnvelope, TranscriptEntry } from "@no-pi-no-gang/contracts";
import MarkdownRender from "markstream-vue";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  api,
  bootstrapFromFragment,
  errorMessage,
  streamEvents,
  type SessionDto,
  type WorkspaceDto,
} from "./api.js";
import { routeRunEvent, terminalStatuses, transcriptText, type UiRun } from "./run-state.js";

const route = useRoute();
const router = useRouter();
const workspace = ref<WorkspaceDto>();
const sessions = ref<SessionDto[]>([]);
const loadingSessions = ref(false);
const creating = ref(false);
const sessionError = ref("");
const startupError = ref("");
const navOpen = ref(false);
const showAuthorize = ref(false);
const candidatePath = ref("");
const previewPath = ref("");
const authorizing = ref(false);
const authorizeError = ref("");
const pathInput = ref<HTMLInputElement>();
const currentSession = computed(() =>
  sessions.value.find(({ id }) => id === route.params.sessionId),
);
const transcript = ref<TranscriptEntry[]>([]);
const loadingTranscript = ref(false);
const transcriptError = ref("");
const prompt = ref("");
const runError = ref("");
const cancelling = ref(false);
const runs = reactive(new Map<string, UiRun>());
const queuedEvents: SSEEventEnvelope[] = [];
const sessionRuns = computed(() =>
  [...runs.values()].filter(({ sessionId }) => sessionId === currentSession.value?.id),
);
const activeRun = computed(() =>
  sessionRuns.value.find(({ status }) => !terminalStatuses.has(status)),
);
const eventController = new AbortController();

onMounted(async () => {
  try {
    await bootstrapFromFragment();
    const result = await api<{ workspaces: WorkspaceDto[] }>("/workspaces");
    workspace.value = result.workspaces[0];
    if (workspace.value) await loadSessions();
    else {
      showAuthorize.value = true;
      await nextTick();
      pathInput.value?.focus();
    }
    void streamEvents(handleEvent, eventController.signal).catch((error) => {
      if (!eventController.signal.aborted) runError.value = errorMessage(error);
    });
  } catch (error) {
    startupError.value = errorMessage(error);
  }
});

onBeforeUnmount(() => eventController.abort());
watch(
  () => [workspace.value?.id, currentSession.value?.id],
  () => void loadTranscript(),
);

async function loadTranscript() {
  const workspaceId = workspace.value?.id;
  const sessionId = currentSession.value?.id;
  if (!workspaceId || !sessionId) {
    transcript.value = [];
    return;
  }
  loadingTranscript.value = true;
  transcriptError.value = "";
  try {
    const result = await api<{ transcript: TranscriptEntry[] }>(
      `/workspaces/${workspaceId}/sessions/${sessionId}/transcript`,
    );
    if (currentSession.value?.id === sessionId) {
      transcript.value = result.transcript;
      for (const run of runs.values())
        if (run.sessionId === sessionId && terminalStatuses.has(run.status)) runs.delete(run.id);
    }
  } catch (error) {
    transcriptError.value = errorMessage(error);
  } finally {
    loadingTranscript.value = false;
  }
}

function handleEvent(value: unknown) {
  const envelope = value as SSEEventEnvelope;
  const run = routeRunEvent(runs, envelope);
  if (!run) {
    if (envelope.sessionId === currentSession.value?.id && queuedEvents.length < 50)
      queuedEvents.push(envelope);
    return;
  }
  if (terminalStatuses.has(run.status) && run.sessionId === currentSession.value?.id)
    void loadTranscript();
}

async function sendPrompt() {
  const workspaceId = workspace.value?.id;
  const sessionId = currentSession.value?.id;
  const text = prompt.value.trim();
  if (!workspaceId || !sessionId || !text || activeRun.value) return;
  runError.value = "";
  try {
    const { run } = await api<{ run: Omit<UiRun, "output"> & { output?: string } }>(
      `/workspaces/${workspaceId}/sessions/${sessionId}/runs`,
      { method: "POST", body: JSON.stringify({ prompt: text, commandId: crypto.randomUUID() }) },
    );
    runs.set(run.id, { ...run, output: run.output ?? "" });
    prompt.value = "";
    for (const event of queuedEvents.splice(0)) handleEvent(event);
  } catch (error) {
    runError.value = errorMessage(error);
  }
}

async function cancelRun() {
  const run = activeRun.value;
  if (!run || cancelling.value) return;
  cancelling.value = true;
  runError.value = "";
  try {
    const result = await api<{ run: { status: UiRun["status"] } }>(
      `/workspaces/${run.workspaceId}/sessions/${run.sessionId}/runs/${run.id}/cancel`,
      { method: "POST", body: JSON.stringify({ commandId: crypto.randomUUID() }) },
    );
    run.status = result.run.status;
    await loadTranscript();
  } catch (error) {
    runError.value = errorMessage(error);
  } finally {
    cancelling.value = false;
  }
}

async function loadSessions() {
  if (!workspace.value || loadingSessions.value) return;
  loadingSessions.value = true;
  sessionError.value = "";
  try {
    sessions.value = (
      await api<{ sessions: SessionDto[] }>(`/workspaces/${workspace.value.id}/sessions`)
    ).sessions;
  } catch (error) {
    sessionError.value = errorMessage(error);
  } finally {
    loadingSessions.value = false;
  }
}

function clearPreview() {
  previewPath.value = "";
  authorizeError.value = "";
}
function closeAuthorize() {
  if (!authorizing.value) showAuthorize.value = false;
}

async function previewWorkspace() {
  if (authorizing.value) return;
  authorizing.value = true;
  authorizeError.value = "";
  try {
    previewPath.value = (
      await api<{ canonicalPath: string }>("/workspaces/preview", {
        method: "POST",
        body: JSON.stringify({ path: candidatePath.value }),
      })
    ).canonicalPath;
  } catch (error) {
    authorizeError.value = errorMessage(error);
  } finally {
    authorizing.value = false;
  }
}

async function confirmWorkspace() {
  if (authorizing.value || !previewPath.value) return;
  authorizing.value = true;
  authorizeError.value = "";
  try {
    workspace.value = (
      await api<{ workspace: WorkspaceDto }>("/workspaces/confirm", {
        method: "POST",
        body: JSON.stringify({ path: previewPath.value, commandId: crypto.randomUUID() }),
      })
    ).workspace;
    showAuthorize.value = false;
    await loadSessions();
  } catch (error) {
    authorizeError.value = errorMessage(error);
  } finally {
    authorizing.value = false;
  }
}

async function createSession() {
  if (!workspace.value || creating.value) return;
  creating.value = true;
  sessionError.value = "";
  try {
    const { session } = await api<{ session: SessionDto }>(
      `/workspaces/${workspace.value.id}/sessions`,
      { method: "POST", body: JSON.stringify({ commandId: crypto.randomUUID() }) },
    );
    sessions.value = [session, ...sessions.value.filter(({ id }) => id !== session.id)];
    await router.push(`/sessions/${session.id}`);
    navOpen.value = false;
  } catch (error) {
    sessionError.value = errorMessage(error);
  } finally {
    creating.value = false;
  }
}
</script>

<style>
:root {
  --canvas: #f6f5f4;
  --surface: #fff;
  --text: #000;
  --muted: #615d59;
  --border: #e6e6e6;
  --primary: #0075de;
  --danger: #8b1e1e;
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 1.5rem;
  --radius: 0.75rem;
  --font: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Consolas, monospace;
  --focus: 0 0 0 3px rgba(0, 117, 222, 0.35);
}
body {
  background: var(--canvas);
  color: var(--text);
  font-family: var(--font);
}
button,
input,
textarea {
  font: inherit;
}
button {
  min-height: 44px;
  padding: 0.55rem 1rem;
  border: 0;
  border-radius: 999px;
  background: var(--primary);
  color: white;
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  box-shadow: var(--focus);
}
.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
}
.sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: var(--space-3);
  overflow: auto;
}
.sidebar > header,
.section-title,
.actions,
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
h1,
h2,
p {
  overflow-wrap: anywhere;
}
h2 {
  font-size: 1rem;
}
.secondary,
.icon-button {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}
.icon-button {
  padding: 0;
  width: 44px;
}
.session-link {
  display: grid;
  gap: 0.25rem;
  margin: 0.5rem 0;
  padding: 0.75rem;
  color: inherit;
  text-decoration: none;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
.session-link.router-link-active {
  border-left: 4px solid var(--primary);
  background: var(--canvas);
}
small,
.eyebrow,
.mono {
  color: var(--muted);
}
.mono {
  font-family: var(--mono);
  overflow-wrap: anywhere;
}
main {
  min-width: 0;
}
.content {
  max-width: 70rem;
  margin: auto;
  padding: clamp(1rem, 5vw, 4rem);
}
.empty {
  margin-top: 2rem;
  padding: var(--space-3);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.notice {
  padding: var(--space-2);
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
.error {
  border-left: 4px solid var(--danger);
}
.status-mark {
  font-weight: 700;
}
.mobile-header {
  display: none;
  padding: var(--space-2);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.35);
}
.modal {
  width: min(32rem, 100%);
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.18);
}
label,
input,
textarea {
  display: block;
  width: 100%;
}
input,
textarea {
  min-height: 44px;
  margin: 0.5rem 0 1rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
}
.preview {
  display: grid;
  gap: 0.5rem;
}
.transcript {
  margin-top: 2rem;
}
.message,
.prompt {
  margin-top: 1rem;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.streaming {
  border-left: 4px solid var(--primary);
}
.prompt textarea {
  resize: vertical;
}
@media (max-width: 700px) {
  .shell {
    display: block;
  }
  .sidebar {
    display: none;
    position: fixed;
    z-index: 2;
    inset: 65px 0 0;
    border: 0;
  }
  .sidebar.open {
    display: block;
  }
  .mobile-header {
    display: flex;
  }
  .content {
    padding: var(--space-3);
  }
}
</style>
