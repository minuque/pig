<template>
  <section class="empty-canvas">
    <div class="empty-canvas-form">
      <WorkbenchHero
        :workspace-id="sessionCwd"
        title-id="session-hero-title"
        class="stagger-in"
        :workspaces="workspaces"
        :selectable="false"
      />
      <ChatInput
        v-model:prompt="prompt"
        v-model:preset="preset"
        :catalog="catalog"
        :running="running"
        :error="sessionError"
        :cwd="sessionCwd"
        :usage="contextUsage"
        :session-id="sessionId"
        class="stagger-in"
        @send="submitText"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import ChatInput from "@features/chat-input/index.vue"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"

const {
  sessionId,
  sessionCwd,
  contextUsage,
  running,
  prompt,
  preset,
  catalog,
  sessionError,
  submitText,
} = useSession()
const { workspaces } = useNav()
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
  width: 100%;
  max-width: var(--size-chat-input);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
</style>
