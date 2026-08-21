<template>
  <Startup :connect="pi.connect" :initialize="session.initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate, collapsed, toggle }">
        <SessionNav :collapsed="collapsed" @navigate="onNavigate" @toggle="toggle" />
      </template>
      <template #header="{ leftOpen, toggle }">
        <WorkbenchHeader :left-open="leftOpen" @toggle="toggle" />
      </template>
      <WorkbenchOutlet />
    </AppLayout>
  </Startup>
  <Toaster position="top-right" close-button :duration="5000" />
</template>

<script setup lang="ts">
import AppLayout from "@components/layout/AppLayout.vue";
import { Toaster } from "@components/ui/sonner/index.js";
import { useLocalWorkspaces } from "@client/local-cwd.js";
import { usePiClient } from "@client/pi-client.js";
import SessionNav from "@features/session-nav/index.vue";
import { provideNav } from "@features/session-nav/index.js";
import Startup from "@features/startup/index.vue";
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue";
import WorkbenchOutlet from "@features/session-workbench/components/WorkbenchOutlet.vue";
import { provideSession } from "@features/session-workbench/index.js";

const pi = usePiClient();
const cwd = useLocalWorkspaces();
const session = provideSession(pi, cwd);
provideNav(pi, cwd, session);
</script>
