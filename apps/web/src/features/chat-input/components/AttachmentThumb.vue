<template>
  <div class="group relative size-12 shrink-0" @mousedown.prevent>
    <Dialog>
      <DialogTrigger as-child>
        <Button
          type="button"
          variant="outline"
          size="icon"
          class="size-12 overflow-hidden rounded-[var(--radius-lg)] p-0"
          :aria-label="alt"
        >
          <img :src="src" :alt="alt" class="absolute inset-0 size-full object-cover" />
        </Button>
      </DialogTrigger>
      <DialogContent
        class="max-h-[90vh] w-full max-w-[min(56rem,calc(100vw-2rem))] overflow-auto p-(--spacing-sm) sm:max-w-[min(56rem,calc(100vw-2rem))]"
      >
        <DialogTitle class="sr-only">{{ alt }}</DialogTitle>
        <img :src="src" :alt="alt" class="max-h-[calc(90vh-2rem)] w-full object-contain" />
      </DialogContent>
    </Dialog>
    <Button
      type="button"
      variant="secondary"
      size="icon-2xs"
      class="absolute top-0 right-0 z-10 bg-ink text-canvas hover:bg-ink hover:text-canvas opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
      aria-label="移除附件"
      @click.stop="emit('remove')"
    >
      <X />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";
import { Button } from "@components/ui/button/index.js";
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
