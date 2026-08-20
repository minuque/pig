<template>
  <AppLayout
    :title="currentTitle"
    :phase="projection?.phase"
    :running="projection?.running"
    :connecting="connecting"
    :thinking-level="projection?.thinkingLevel"
    :class="['startup-underlay-transition', { 'startup-underlay': startupWait }]"
    :inert="startupWait || undefined"
    :aria-hidden="startupWait ? 'true' : undefined"
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

  <Transition name="startup-wait">
    <StartupWait v-if="startupWait && !startupError" :phase="startupPhase" />
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import AppLayout from "@components/layout/AppLayout.vue";
import { bootstrapFromUrl } from "@client/bootstrap.js";
import { errorMessage } from "@client/http.js";
import { useLocalWorkspaces } from "@client/local-cwd.js";
import { usePiClient } from "@client/pi-client.js";
import SessionNav from "@features/session-nav/index.vue";
import { provideNav } from "@features/session-nav/index.js";
import StartupWait from "@features/startup-wait/index.vue";
import type { StartupPhase } from "@features/startup-wait/types.js";
import { UNTITLED_SESSION } from "@features/session-nav/types.js";
import { provideSession } from "@features/session-workbench/index.js";

const pi = usePiClient();
const cwd = useLocalWorkspaces();
const session = provideSession(pi, cwd);
provideNav(pi, cwd, session);

const startupError = shallowRef("");
const startupWait = shallowRef(true);
const startupPhase = shallowRef<StartupPhase>("authorizing");

onMounted(async () => {
  try {
    await bootstrapFromUrl();
    startupPhase.value = "connecting";
    await pi.connect();
    startupPhase.value = "preparing";
    await session.initialize();
    startupWait.value = false;
  } catch (error) {
    startupError.value = errorMessage(error);
    startupWait.value = false;
  }
});

const connecting = computed(() => pi.connectionState.value === "connecting");
const { connectionError, connected } = pi;
const { projection, sessionId } = session;

const currentTitle = computed(
  () => projection.value?.name ?? (sessionId.value ? UNTITLED_SESSION : ""),
);
</script>

<style scoped>
.startup-error {
  margin: var(--spacing-md);
}
</style>

<style>
.startup-underlay {
  opacity: 0;
}
.startup-underlay-transition {
  transition: opacity 360ms var(--ease-out) 60ms;
}
@media (prefers-reduced-motion: reduce) {
  .startup-underlay-transition {
    transition: none;
  }
}
</style>
