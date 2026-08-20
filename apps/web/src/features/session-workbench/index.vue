<template>
  <section
    v-if="sessionId"
    :key="sessionId"
    class="workspace-main enter-blur"
    :style="emptyCanvas ? undefined : { '--chat-input-space': `${dockHeight}px` }"
    :aria-labelledby="emptyCanvas ? 'session-hero-title' : 'current-title'"
  >
    <div v-if="emptyCanvas" class="empty-canvas">
      <div class="empty-canvas-form">
        <WorkspaceHero
          :workspace-id="activeWorkspaceId"
          title-id="session-hero-title"
          :workspaces="workspaces"
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

/** 无 transcript 且未运行：居中空画布。运行中即使无行仍贴底 + shimmer。 */
export function isEmptyCanvas(transcriptLength: number, phase: SessionPhase | undefined): boolean {
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
const { workspaces, activeWorkspaceId } = useNav();

const emptyCanvas = computed(() => isEmptyCanvas(transcript.value.length, phase.value));

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
