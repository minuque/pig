<template>
  <section
    v-if="sessionId"
    :key="sessionId"
    class="workspace-main enter-blur"
    :style="{ '--chat-input-space': `${dockHeight}px` }"
    aria-labelledby="current-title"
  >
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
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue";
import ChatInput from "@features/chat-input/index.vue";
import { useWorkspace } from "@app/hooks/use-app.js";
import TranscriptView from "@features/session-workbench/components/TranscriptView.vue";

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
} = useWorkspace();

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
}
.workspace-main :deep(.transcript-region) {
  height: 100%;
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
