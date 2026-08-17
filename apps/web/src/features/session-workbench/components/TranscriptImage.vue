<template>
  <DialogRoot>
    <DialogTrigger as-child>
      <button type="button" class="thumb" :aria-label="alt">
        <img :src="src" :alt="alt" class="thumb-img" />
      </button>
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="scrim" />
      <DialogContent class="lightbox">
        <DialogTitle class="sr-only">{{ alt }}</DialogTitle>
        <img :src="src" :alt="alt" class="full" />
        <DialogClose class="close" aria-label="关闭">
          <X :size="16" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "reka-ui";
import { X } from "lucide-vue-next";
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
.scrim {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--scrim);
}
.lightbox {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 50;
  box-sizing: border-box;
  max-width: min(56rem, calc(100vw - 2rem));
  max-height: 90vh;
  padding: var(--spacing-sm);
  overflow: auto;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-modal);
  transform: translate(-50%, -50%);
}
.close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}
</style>
