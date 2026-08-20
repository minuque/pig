<template>
  <AppLayout
    :title="currentTitle"
    :cwd="activeCwd"
    :phase="projection?.phase"
    :running="projection?.running"
    :connecting="connecting"
    :thinking-level="projection?.thinkingLevel"
    :class="{
      'startup-underlay': startupConcealed,
      'startup-underlay-transition': startupVisible,
    }"
    :inert="startupVisible || undefined"
    :aria-hidden="startupVisible ? 'true' : undefined"
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

  <StartupWait
    v-if="startupVisible && !startupError"
    :ready="startupReady"
    :phase="startupPhase"
    @reveal="revealStartupUnderlay"
    @finished="finishStartupWait"
  />
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
const nav = provideNav(pi, cwd, session);

const startupError = shallowRef("");
const startupVisible = shallowRef(true);
const startupConcealed = shallowRef(true);
const startupReady = shallowRef(false);
const startupPhase = shallowRef<StartupPhase>("authorizing");

function revealStartupUnderlay() {
  startupConcealed.value = false;
}

function finishStartupWait() {
  startupConcealed.value = false;
  startupVisible.value = false;
}

onMounted(async () => {
  try {
    await bootstrapFromUrl();
    startupPhase.value = "connecting";
    await pi.connect();
    startupPhase.value = "preparing";
    await session.initialize();
    startupReady.value = true;
  } catch (error) {
    startupError.value = errorMessage(error);
    startupConcealed.value = false;
    startupVisible.value = false;
  }
});

const connecting = computed(() => pi.connectionState.value === "connecting");
const { connectionError, connected } = pi;
const { projection, sessionId } = session;

const currentTitle = computed(
  () => projection.value?.name ?? (sessionId.value ? UNTITLED_SESSION : ""),
);
const activeCwd = computed(() => (sessionId.value ? nav.activeWorkspaceId.value : undefined));
</script>

<style scoped>
.startup-error {
  margin: var(--spacing-md);
}
</style>
