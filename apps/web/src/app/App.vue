<template>
  <AppLayout :title="currentTitle" :phase="projection?.phase" :running="projection?.running">
    <template #sidebar="{ onNavigate }">
      <SessionNav @navigate="onNavigate" />
    </template>

    <div v-if="startupError" class="notice error startup-error" role="alert">
      {{ startupError }}
    </div>
    <p v-else-if="connecting" class="notice startup-error" role="status">正在连接本地服务…</p>
    <p v-else-if="connectionError && connected" class="notice error startup-error" role="alert">
      {{ connectionError.message }}
    </p>
    <RouterView v-else />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppLayout from "@components/layout/AppLayout.vue";
import SessionNav from "@features/sessions/SessionNav.vue";
import { provideWorkspace } from "@app/hooks/use-app.js";

const { startupError, connecting, connectionError, connected, projection, sessionId } =
  provideWorkspace();

const currentTitle = computed(
  () => projection.value?.name ?? (sessionId.value ? "Session" : "新建 Session"),
);
</script>

<style scoped>
.startup-error {
  margin: var(--spacing-md);
}
</style>
