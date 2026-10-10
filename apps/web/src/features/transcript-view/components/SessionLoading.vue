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
  inset: 0 0 var(--composer-reserve, 0px) 0;
  z-index: 5;
  display: grid;
  place-items: center;
  /* 不再铺 surface：切换时下面有克隆层挡着，这里只留菊花 */
  background: transparent;
  pointer-events: none;
}
</style>
