<template>
  <WorkbenchHeader />
  <StartupError
    v-if="connectionError && connected"
    title="连接失败"
    :detail="connectionError.message"
  />
  <RouterView v-else />
</template>

<script setup lang="ts">
import StartupError from "@features/startup/components/StartupError.vue";
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue";
import { useSession } from "@features/session-workbench/index.js";

const { connectionError, connected } = useSession();
</script>
