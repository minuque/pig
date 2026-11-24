<template>
  <div class="session-loading">
    <Spinner size="m" />
  </div>
</template>

<script setup lang="ts">
import { Spinner } from "@pig/ui/spinner"
</script>

<style scoped>
.session-loading {
  position: absolute;
  inset: 0 0 var(--composer-reserve, 0px) 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  background: transparent;
  pointer-events: none;
}
</style>
