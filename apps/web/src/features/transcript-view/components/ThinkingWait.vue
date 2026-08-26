<template>
  <div class="wait">
    <ThinkingOrb />
    <ThinkingState text="思考中…" />
  </div>
</template>

<script setup lang="ts">
import ThinkingOrb from "@features/transcript-view/components/ThinkingOrb.vue"
import ThinkingState from "@features/transcript-view/components/ThinkingState.vue"
</script>

<style scoped>
.wait {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  margin-bottom: var(--spacing-xxs);
  border: 0;
  outline: none;
  color: var(--ink-faint);
}
</style>
