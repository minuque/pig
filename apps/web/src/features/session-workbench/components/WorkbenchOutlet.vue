<template>
  <p v-if="connectionError && connected" class="notice error connection-error" role="alert">
    {{ connectionError.message }}
  </p>
  <RouterView v-else />
</template>

<script setup lang="ts">
import { useSession } from "@features/session-workbench/index.js";

const { connectionError, connected } = useSession();
</script>

<style scoped>
.connection-error {
  margin: var(--spacing-md);
}
</style>
