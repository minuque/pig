<template>
  <Dialog>
    <DialogTrigger as-child>
      <button type="button" class="thumb">
        <img :src="src" :alt="alt" class="thumb-img" />
      </button>
    </DialogTrigger>

    <DialogContent
      class="!w-fit max-h-[90vh] max-w-[calc(100vw-2rem)] place-items-center overflow-auto p-(--spacing-sm) sm:!w-fit sm:!max-w-[calc(100vw-2rem)]"
    >
      <img :src="src" :alt="alt" class="full" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Dialog, DialogContent, DialogTrigger } from "@components/ui/dialog/index.js"
import { transcriptImageSrc } from "@features/transcript-view/lib/transcript-format.js"

const props = withDefaults(
  defineProps<{
    data: string
    mimeType: string
    alt?: string
  }>(),
  { alt: "图片" },
)

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
  background: var(--canvas-soft);
  cursor: zoom-in;
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
