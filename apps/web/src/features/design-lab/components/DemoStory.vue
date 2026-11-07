<template>
  <div class="demo-story">
    <slot />
  </div>
</template>

<script setup lang="ts">
// 只收标题，展示时由标签页给出名字
defineProps<{ title?: string }>()
</script>

<style scoped>
.demo-story {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}
</style>
