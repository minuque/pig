<template>
  <Dialog>
    <DialogTrigger as-child>
      <button type="button" class="thumb" :aria-label="alt">
        <img :src="src" :alt="alt" class="thumb-img" />
      </button>
    </DialogTrigger>
    <DialogContent
      class="max-h-[90vh] w-full max-w-[min(56rem,calc(100vw-2rem))] overflow-auto p-(--spacing-sm) sm:max-w-[min(56rem,calc(100vw-2rem))]"
    >
      <DialogTitle class="sr-only">{{ alt }}</DialogTitle>
      <img :src="src" :alt="alt" class="full" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@components/ui/dialog/index.js";
import { transcriptImageSrc } from "@features/session-workbench/lib/transcript-format.js";

const props = withDefaults(
  defineProps<{
    data: string;
    mimeType: string;
    alt?: string;
  }>(),
  { alt: "图片" },
);

const src = computed(() => transcriptImageSrc(props.data, props.mimeType));
</script>

<style scoped>
.thumb {
  display: block;
  max-width: min(20rem, 86%);
  padding: 0;
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
  cursor: zoom-in;
}
.thumb-img,
.full {
  display: block;
  width: 100%;
  height: auto;
}
.full {
  max-height: calc(90vh - 2rem);
  object-fit: contain;
}
</style>
