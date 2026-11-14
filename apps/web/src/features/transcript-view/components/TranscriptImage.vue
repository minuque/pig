<template>
  <button type="button" class="thumb" @click="open = true">
    <img :src="src" :alt="altText" class="thumb-img" />
  </button>

  <PreviewDialog v-model:open="open" :src="src" :title="altText" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import PreviewDialog from "@features/preview/index.vue"
import { transcriptImageSrc } from "@features/transcript-view/lib/transcript-format.js"

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    data: string
    mimeType: string
    alt?: string
  }>(),
  { alt: "" },
)
const open = ref(false)
const altText = computed(() => props.alt || t("transcript.image"))
const src = computed(() => transcriptImageSrc(props.data, props.mimeType))
</script>

<style scoped>
.thumb {
  display: block;
  width: 30%;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-card);
  background: var(--background);
  cursor: zoom-in;
}

.thumb-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: inherit;
  outline: var(--border-width) solid var(--border-soft);
  outline-offset: -1px;
}
</style>
