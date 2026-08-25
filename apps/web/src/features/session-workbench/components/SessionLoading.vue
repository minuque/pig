<template>
  <div class="session-loading" role="status" aria-live="polite" aria-busy="true">
    <Spinner :size="24" aria-hidden="true" />
    <p class="sr-only">正在加载会话</p>
  </div>
</template>

<script setup lang="ts">
import { Spinner } from "@components/ui/spinner/index.js"
</script>

<style scoped>
.session-loading {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  background: var(--surface);
}
</style>
