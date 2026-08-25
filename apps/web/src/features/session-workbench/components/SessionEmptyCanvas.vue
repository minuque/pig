<template>
  <section class="empty-canvas enter-blur" aria-labelledby="session-hero-title">
    <div class="empty-canvas-form">
      <WorkbenchHero
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
        :error="sessionError"
        :cwd="composerCwd"
        :usage="contextUsage"
        :session-id="sessionId"
        @send="submitText"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import ChatInput from "@features/chat-input/index.vue"
import { projectContextUsage } from "@features/chat-input/lib/context-usage.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"

const {
  sessionId,
  contextUsageEstimate,
  phase,
  prompt,
  preset,
  catalog,
  projection,
  sessionError,
  submitText,
} = useSession()
const { workspaces, activeWorkspaceId, lastCwd } = useNav()

const heroCwd = computed(() => activeWorkspaceId.value ?? lastCwd.value)
const composerCwd = computed(() => projection.value?.cwd ?? heroCwd.value)
const contextUsage = computed(() => projectContextUsage(contextUsageEstimate.value))
</script>

<style scoped>
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
.enter-blur {
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .enter-blur {
    animation: none;
  }
}
</style>
