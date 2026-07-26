<script setup lang="ts">
import type { ProviderId, SessionId } from "@no-pi-no-gang/contracts";
import { computed, toRef } from "vue";
import PromptComposer from "@/features/session/components/PromptComposer.vue";
import { useSessionView } from "@/features/session/use-session-view";
import TranscriptList from "@/features/transcript/components/TranscriptList.vue";

/**
 * The conversation region: Session header (name, availability, live run
 * state), the Transcript, and the composer. Durable facts come from Vue
 * Query, realtime state from the Live Overlay — this component only wires
 * the two views together.
 */
const props = defineProps<{ sessionId: SessionId | undefined }>();
const emit = defineEmits<{ authorize: [providerId: ProviderId] }>();

const {
  session,
  snapshotPending,
  snapshotError,
  entries,
  activeRun,
  transcriptPending,
  transcriptError,
  canLoadOlder,
  historyTruncated,
  liveAnnouncement,
  loadOlder,
} = useSessionView(toRef(props, "sessionId"));

const sessionAvailable = computed(
  () => session.value?.availability === "healthy",
);
</script>

<template>
  <section class="conversation" aria-label="对话">
    <template v-if="sessionId === undefined">
      <div class="conversation-empty">
        <h1 class="empty-title">选择一个会话开始工作</h1>
        <p class="empty-hint">从左侧会话列表选择，或创建一个新会话。</p>
      </div>
    </template>

    <template v-else>
      <header class="conversation-header">
        <h1 class="conversation-title">
          {{ session?.name ?? "会话" }}
        </h1>
        <span
          v-if="session && session.availability !== 'healthy'"
          class="badge"
          :data-tone="
            session.availability === 'quarantined' ? 'danger' : 'warning'
          "
        >
          {{
            session.availability === "quarantined"
              ? "已隔离"
              : session.availability === "unavailable"
                ? "不可用"
                : "待校验"
          }}
        </span>
        <span v-if="activeRun" class="badge" data-tone="warning">
          {{ liveAnnouncement }}
        </span>
      </header>

      <p v-if="snapshotError" class="conversation-error" role="alert">
        无法加载会话：{{ snapshotError.message }}
      </p>
      <p v-else-if="transcriptError" class="conversation-error" role="alert">
        无法加载消息记录：{{ transcriptError.message }}
      </p>

      <TranscriptList
        v-if="sessionId !== undefined"
        :session-id="sessionId"
        :entries="entries"
        :pending="snapshotPending || transcriptPending"
        :can-load-older="canLoadOlder"
        :history-truncated="historyTruncated"
        :live-announcement="liveAnnouncement"
        @load-older="loadOlder"
      />

      <PromptComposer
        :session-id="sessionId"
        :active-run="activeRun"
        :session-available="sessionAvailable"
        @authorize="emit('authorize', $event)"
      />
    </template>
  </section>
</template>

<style scoped>
.conversation {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-canvas);
}

.conversation-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
}

.empty-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 400;
}

.empty-hint {
  color: var(--color-foreground-muted);
}

.conversation-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  min-height: var(--target-min);
}

.conversation-title {
  font-size: var(--text-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-error {
  margin: var(--space-3) var(--space-4) 0;
  padding: var(--space-3);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
