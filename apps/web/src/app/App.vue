<template>
  <AppLayout
    :title="currentTitle"
    :phase="projection?.phase"
    :running="projection?.running"
    :connecting="connecting"
    :thinking-level="projection?.thinkingLevel"
  >
    <template #sidebar="{ onNavigate, collapsed, toggle }">
      <SessionNav :collapsed="collapsed" @navigate="onNavigate" @toggle="toggle" />
    </template>

    <div v-if="startupError" class="notice error startup-error" role="alert">
      {{ startupError }}
    </div>
    <p v-else-if="connectionError && connected" class="notice error startup-error" role="alert">
      {{ connectionError.message }}
    </p>
    <RouterView v-else />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppLayout from "@components/layout/AppLayout.vue";
import SessionNav from "@features/session-nav/index.vue";
import { provideWorkspace } from "@app/hooks/use-app.js";
import { UNTITLED_SESSION } from "@features/session-nav/types.js";

const { startupError, connecting, connectionError, connected, projection, sessionId } =
  provideWorkspace();

const currentTitle = computed(
  () => projection.value?.name ?? (sessionId.value ? UNTITLED_SESSION : ""),
);
</script>

<style scoped>
.startup-error {
  margin: var(--spacing-md);
}
</style>
