<template>
  <Dialog>
    <DialogTrigger as-child>
      <button type="button" class="thumb">
        <img :src="src" :alt="altText" class="thumb-img" />
      </button>
    </DialogTrigger>

    <DialogContent class="zoom-dialog">
      <img :src="src" :alt="altText" class="full" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogContent, DialogTrigger } from "@components/ui/dialog/index.js"
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
  border-radius: var(--radius-lg);
  background: var(--background-soft);
  cursor: zoom-in;
}

/* 图片预览：按内容收缩，再受视口约束 */
.zoom-dialog {
  place-items: center;
  inline-size: fit-content;
  max-inline-size: calc(100vw - 2rem);
  max-block-size: 90vh;
  overflow: auto;
  padding: var(--space-sm);
}

.thumb-img,
.full {
  display: block;
  height: auto;
  border-radius: inherit;
  outline: var(--border-width) solid var(--media-outline);
  outline-offset: -1px;
}

.thumb-img {
  width: 100%;
}

.full {
  width: auto;
  max-width: none;
  margin-inline: auto;
  border-radius: var(--radius-lg);
}
</style>
