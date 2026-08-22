<template>
  <section
    v-if="sessionId"
    class="workspace-main enter-blur"
    :style="emptyCanvas || sessionPending ? undefined : { '--chat-input-space': `${dockHeight}px` }"
    :aria-labelledby="emptyCanvas ? 'session-hero-title' : 'current-title'"
    :aria-busy="sessionPending || undefined"
  >
    <div v-if="sessionPending" class="session-loading" role="status" aria-live="polite">
      <p class="sr-only">正在加载会话</p>
      <div class="session-loading-stack" aria-hidden="true">
        <div class="session-loading-user"></div>
        <div class="session-loading-agent"></div>
        <div class="session-loading-agent session-loading-agent--short"></div>
        <div class="session-loading-user session-loading-user--short"></div>
        <div class="session-loading-agent"></div>
      </div>
    </div>
    <div v-else-if="emptyCanvas" class="empty-canvas">
      <div class="empty-canvas-form">
        <WorkspaceHero
          :workspace-id="heroCwd"
          title-id="session-hero-title"
          :workspaces="workspaces"
          :selectable="false"
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
      </div>
    </div>

    <template v-else>
      <TranscriptView
        :session-id="sessionId"
        :transcript="transcript"
        :phase="phase"
        :thread-state="clientState?.threadState ?? null"
        @thread-state="applyThreadState"
      />

      <div ref="dock" class="chat-input-dock">
        <ChatInput
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="catalog"
          :phase="phase"
          :queued-steer-count="queuedSteerCount"
          :aborting="aborting"
          :error="sessionError"
          docked
          @send="submitText"
          @abort="abortSession"
        />
      </div>
    </template>
  </section>
</template>

<script lang="ts">
import type { SessionPhase } from "@earendil-works/pi-protocol";

/** 无 transcript 且未运行：居中空画布。加载中、运行中即使无行也不走空画布。 */
export function isEmptyCanvas(
  transcriptLength: number,
  phase: SessionPhase | undefined,
  pending = false,
): boolean {
  if (pending) return false;
  return transcriptLength === 0 && (phase === undefined || phase === "idle");
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue";
import ChatInput from "@features/chat-input/index.vue";
import { useNav } from "@features/session-nav/index.js";
import { useSession } from "@features/session-workbench/index.js";
import TranscriptView from "@features/session-workbench/components/TranscriptView.vue";
import WorkspaceHero from "@features/session-workbench/components/WorkspaceHero.vue";

const {
  sessionId,
  transcript,
  phase,
  sessionPending,
  aborting,
  clientState,
  abortSession,
  applyThreadState,
  prompt,
  preset,
  catalog,
  queuedSteerCount,
  sessionError,
  submitText,
} = useSession();
const { workspaces, activeWorkspaceId, lastCwd } = useNav();

const emptyCanvas = computed(() =>
  isEmptyCanvas(transcript.value.length, phase.value, sessionPending.value),
);
const heroCwd = computed(() => activeWorkspaceId.value ?? lastCwd.value);

const dock = useTemplateRef<HTMLElement>("dock");
const dockHeight = shallowRef(168);
let dockObserver: ResizeObserver | undefined;

watch(
  dock,
  (element) => {
    dockObserver?.disconnect();
    if (!element) return;
    dockObserver = new ResizeObserver(() => {
      dockHeight.value = element.offsetHeight;
    });
    dockObserver.observe(element);
    dockHeight.value = element.offsetHeight;
  },
  { flush: "post" },
);
onBeforeUnmount(() => dockObserver?.disconnect());
</script>

<style scoped>
.workspace-main {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  background: var(--surface);
  display: flex;
  flex-direction: column;
}
.workspace-main :deep(.transcript-region) {
  height: 100%;
  flex: 1;
}
.session-loading {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  padding: var(--spacing-lg) var(--spacing-md);
}
.session-loading-stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: min(var(--size-content), 100%);
  margin-inline: auto;
}
.session-loading-user,
.session-loading-agent {
  background-size: 200% 100%;
  animation: shimmer var(--duration-shimmer) var(--ease-in-out) infinite;
}
.session-loading-user {
  align-self: flex-end;
  width: min(42%, 280px);
  height: 40px;
  border-radius: var(--radius-xl);
  background-image: linear-gradient(
    90deg,
    color-mix(in srgb, var(--primary) 22%, transparent) 25%,
    color-mix(in srgb, var(--primary) 36%, transparent) 50%,
    color-mix(in srgb, var(--primary) 22%, transparent) 75%
  );
}
.session-loading-user--short {
  width: min(28%, 180px);
}
.session-loading-agent {
  align-self: stretch;
  height: 72px;
  border-radius: var(--radius-md);
  background-image: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ink) 6%, transparent) 25%,
    color-mix(in srgb, var(--ink) 11%, transparent) 50%,
    color-mix(in srgb, var(--ink) 6%, transparent) 75%
  );
}
.session-loading-agent--short {
  width: 70%;
  height: 28px;
}
@media (prefers-reduced-motion: reduce) {
  .session-loading-user,
  .session-loading-agent {
    animation: none;
  }
}
.empty-canvas {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 var(--spacing-md);
}
.empty-canvas-form {
  width: min(var(--size-composer), 100%);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.chat-input-dock {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding: 32px var(--spacing-md) 10px;
  background: transparent;
  pointer-events: none;
}
.chat-input-dock :deep(.prompt) {
  pointer-events: auto;
  width: min(var(--size-composer), 100%);
  margin-inline: auto;
}
.enter-blur {
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .enter-blur {
    animation: none;
  }
}
@media (max-width: 900px) {
  .chat-input-dock {
    padding-inline: var(--spacing-sm);
  }
}
</style>
