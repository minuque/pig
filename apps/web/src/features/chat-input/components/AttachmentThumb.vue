<template>
  <div class="thumb-wrap" @mousedown.prevent>
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
    <button type="button" class="remove" aria-label="移除附件" @click.stop="emit('remove')">
      <X :size="12" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@components/ui/dialog/index.js";

const props = defineProps<{
  src: string;
  name: string;
}>();

const emit = defineEmits<{
  remove: [];
}>();

const alt = computed(() => props.name || "图片");
</script>

<style scoped>
.thumb-wrap {
  position: relative;
  flex: none;
  width: 48px;
  height: 48px;
}
.thumb {
  display: block;
  width: 48px;
  height: 48px;
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
  height: 100%;
  object-fit: cover;
}
.full {
  height: auto;
  max-height: calc(90vh - 2rem);
  object-fit: contain;
}
.remove {
  position: absolute;
  z-index: 1;
  top: 2px;
  right: 2px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  min-width: 16px;
  min-height: 16px;
  max-height: 16px;
  padding: 0;
  line-height: 0;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--surface);
  color: var(--ink-muted);
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}
.thumb-wrap:hover .remove,
.remove:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
.remove:hover,
.remove:focus-visible {
  color: var(--ink);
}
@media (prefers-reduced-motion: reduce) {
  .remove {
    transition: none;
  }
}
</style>
