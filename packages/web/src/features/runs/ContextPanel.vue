<template>
  <aside class="context-panel" :class="{ open }" aria-label="Run、Session 与 Gateway context">
    <header>
      <h2>Context</h2>
      <button
        class="icon-button panel-close"
        type="button"
        aria-label="收起 Context"
        @click="emit('close')"
      >
        ›
      </button>
    </header>
    <section>
      <p class="eyebrow">RUN</p>
      <h2>{{ activeRun ? `Run ${activeRun.id.slice(0, 8)}` : "No active run" }}</h2>
      <p v-if="activeRun" class="run-status-line">
        <RunStatusBadge :status="activeRun.status" />
      </p>
      <p v-else><strong>Status:</strong> Idle</p>
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
          @click="emit('rename-session')"
        >
          重命名
        </button>
        <button
          class="secondary"
          type="button"
          :disabled="!currentSession"
          @click="emit('delete-session')"
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
</template>

<script setup lang="ts">
import type { SessionDto } from "../../api/index.js";
import type { UiRun } from "./run-state.js";
import RunStatusBadge from "./RunStatusBadge.vue";

defineProps<{
  open: boolean;
  activeRun?: UiRun | undefined;
  currentSession?: SessionDto | undefined;
  startupError: string;
  runError: string;
}>();

const emit = defineEmits<{
  close: [];
  "rename-session": [];
  "delete-session": [];
}>();
</script>
