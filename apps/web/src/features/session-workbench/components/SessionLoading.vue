<template>
  <div class="session-loading">
    <Spinner :size="24" />
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
  background: var(--main);
}
</style>
