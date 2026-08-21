<template>
  <StartupWait :connect="connect" :initialize="initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate, collapsed, toggle }">
        <SessionNav :collapsed="collapsed" @navigate="onNavigate" @toggle="toggle" />
      </template>
      <template #header="{ leftOpen, toggle }">
        <WorkbenchHeader :left-open="leftOpen" :connecting="connecting" @toggle="toggle" />
      </template>

      <p v-if="connectionError && connected" class="notice error startup-error" role="alert">
        {{ connectionError.message }}
      </p>
      <RouterView v-else />
    </AppLayout>
  </StartupWait>
</template>

<script setup lang="ts">
import { computed } from "vue";
import AppLayout from "@components/layout/AppLayout.vue";
import { useLocalWorkspaces } from "@client/local-cwd.js";
import { usePiClient } from "@client/pi-client.js";
import SessionNav from "@features/session-nav/index.vue";
import { provideNav } from "@features/session-nav/index.js";
import StartupWait from "@features/startup-wait/index.vue";
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue";
import { provideSession } from "@features/session-workbench/index.js";

const pi = usePiClient();
const cwd = useLocalWorkspaces();
const session = provideSession(pi, cwd);
provideNav(pi, cwd, session);

function connect() {
  return pi.connect();
}
function initialize() {
  return session.initialize();
}

const connecting = computed(() => pi.connectionState.value === "connecting");
const { connectionError, connected } = pi;
</script>

<style scoped>
.startup-error {
  margin: var(--spacing-md);
}
</style>
