<template>
  <div class="group relative size-12 shrink-0">
    <Dialog>
      <DialogTrigger as-child>
        <Button
          type="button"
          variant="outline"
          size="icon"
          :aria-label="`预览 ${alt}`"
          class="preview size-12 overflow-hidden rounded-[var(--radius-lg)] p-0"
        >
          <img
            :src="src"
            :alt="alt"
            class="absolute inset-0 size-full object-cover"
            draggable="false"
          />
        </Button>
      </DialogTrigger>

      <DialogContent
        :show-close-button="false"
        :aria-describedby="undefined"
        class="max-h-[90dvh] w-full max-w-[min(56rem,calc(100vw-2rem))] overflow-auto p-(--spacing-sm) sm:max-w-[min(56rem,calc(100vw-2rem))]"
      >
        <div class="flex min-w-0 items-center justify-between gap-(--spacing-xs)">
          <DialogTitle class="truncate">{{ alt }}</DialogTitle>

          <DialogClose as-child>
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="关闭图片预览"
            >
              <X />
            </Button>
          </DialogClose>
        </div>

        <img
          :src="src"
          :alt="alt"
          class="max-h-[calc(90dvh-6rem)] w-full object-contain"
          draggable="false"
        />
      </DialogContent>
    </Dialog>

    <Button
      type="button"
      size="icon-2xs"
      class="remove motion-hint"
      :aria-label="`移除 ${alt}`"
      @click.stop="emit('remove')"
    >
      <X />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { X } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@components/ui/dialog/index.js"

const props = defineProps<{
  src: string
  name: string
}>()

const emit = defineEmits<{
  remove: []
}>()

const alt = computed(() => props.name || "图片")
</script>

<style scoped>
img {
  outline: 1px solid var(--media-outline);
  outline-offset: -1px;
}

.preview {
  position: relative;
  border: 0;
}

.preview:focus-visible,
.remove:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.remove {
  position: absolute;
  inset-block-start: calc(-1 * var(--spacing-xxs));
  inset-inline-end: calc(-1 * var(--spacing-xxs));
  z-index: 1;
  width: var(--spacing-lg);
  height: var(--spacing-lg);
  min-width: var(--spacing-lg);
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--inverse-bg);
  color: var(--inverse-fg);
  box-shadow: none;
}

.remove:hover,
.remove:focus-visible {
  background: var(--inverse-bg-hover);
  color: var(--inverse-fg);
}
</style>
