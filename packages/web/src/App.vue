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
import MarkdownRender from "markstream-vue";
import { RouterLink } from "vue-router";
import { useApp } from "./use-app.js";

const {
  workspace,
  sessions,
  loadingSessions,
  creating,
  sessionError,
  startupError,
  navOpen,
  showAuthorize,
  candidatePath,
  previewPath,
  authorizing,
  authorizeError,
  pathInput,
  currentSession,
  transcript,
  loadingTranscript,
  transcriptError,
  prompt,
  runError,
  cancelling,
  sessionRuns,
  activeRun,
  terminalStatuses,
  transcriptText,
  loadSessions,
  sendPrompt,
  cancelRun,
  clearPreview,
  closeAuthorize,
  previewWorkspace,
  confirmWorkspace,
  createSession,
} = useApp();
</script>
