<template>
  <article class="user">
    <p v-if="item.text" class="prompt">{{ item.text }}</p>
    <div v-if="item.images.length" class="images">
      <TranscriptImage
        v-for="(image, index) in item.images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import type { UserRow } from "@features/transcript-view/type.js"

defineProps<{
  item: UserRow
}>()
</script>

<style scoped>
.user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
}
.prompt {
  box-sizing: border-box;
  width: fit-content;
  max-width: min(calc(var(--size-content) * 0.702), 86%);
  max-height: calc(1.5em * 16);
  margin: 0;
  padding: var(--spacing-xs) 14px;
  overflow: auto;
  border-radius: var(--radius-xl);
  background: var(--user-prompt-bg);
  color: var(--ink);
  font-size: var(--text-body-md);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  cursor: pointer;
}

.images {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
  max-width: 100%;
}
</style>
