<template>
  <article class="user">
    <p v-if="text" class="prompt">{{ text }}</p>
    <div v-if="images.length" class="images">
      <TranscriptImage
        v-for="(image, index) in images"
        :key="index"
        :data="image.data"
        :mime-type="image.mimeType"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UserTranscriptItem } from "@earendil-works/pi-protocol";
import TranscriptImage from "@features/session-workbench/components/TranscriptImage.vue";
import {
  transcriptImages,
  transcriptText,
} from "@features/session-workbench/lib/transcript-format.js";

const props = defineProps<{
  item: UserTranscriptItem;
}>();

const text = computed(() => transcriptText(props.item));
const images = computed(() => transcriptImages(props.item));
</script>

<style scoped>
.user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-lg);
}
.prompt {
  box-sizing: border-box;
  width: fit-content;
  max-width: min(40rem, 86%);
  max-height: calc(1.5em * 16);
  margin: 0;
  padding: 8px 14px;
  overflow: auto;
  border-radius: var(--radius-xl);
  background: var(--primary);
  color: color-mix(in srgb, var(--on-primary) 78%, var(--secondary));
  font-size: var(--text-body-md);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.images {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-xs);
  max-width: 100%;
}
</style>
