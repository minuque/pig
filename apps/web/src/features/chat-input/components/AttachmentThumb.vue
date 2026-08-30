<template>
  <div class="group relative size-12 shrink-0" @mousedown.prevent>
    <Dialog>
      <DialogTrigger as-child>
        <Button
          type="button"
          variant="outline"
          size="icon"
          static
          class="preview size-12 overflow-hidden rounded-[var(--radius-lg)] p-0"
        >
          <img
            :src="src"
            :alt="alt"
            class="media-inset-outline absolute inset-0 size-full object-cover"
          />
        </Button>
      </DialogTrigger>
      <DialogContent
        class="max-h-[90vh] w-full max-w-[min(56rem,calc(100vw-2rem))] overflow-auto p-(--spacing-sm) sm:max-w-[min(56rem,calc(100vw-2rem))]"
      >
        <img
          :src="src"
          :alt="alt"
          class="media-inset-outline max-h-[calc(90vh-2rem)] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
    <Button type="button" size="icon-2xs" class="remove motion-hint" @click.stop="emit('remove')">
      <X />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { X } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import { Dialog, DialogContent, DialogTrigger } from "@components/ui/dialog/index.js"

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
.preview {
  border: 0;
}
/* 全局 button reset 后本钮自行重盖：深色圆底不跟 ink 反相，白图也能看清。 */
.remove {
  position: absolute;
  top: -6px;
  right: -6px;
  z-index: 1;
  width: 16px;
  height: 16px;
  min-width: 16px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-midnight);
  color: var(--on-primary);
  box-shadow: none;
}
.remove:hover,
.remove:focus-visible {
  background: var(--accent-midnight);
  color: var(--on-primary);
}
</style>
