<template>
  <span v-if="images.length" class="tool-thumbs">
    <Tooltip v-for="(image, i) in images" :key="i" :delay-duration="150">
      <TooltipTrigger as-child>
        <button
          type="button"
          class="tool-thumb"
          :aria-label="t('common.preview', { name: image.title })"
          @click.stop="show(i)"
        >
          <img :src="image.src" alt="" />
        </button>
      </TooltipTrigger>

      <TooltipContent class="tool-thumb-tip" :side-offset="6">
        <img :src="image.src" alt="" />
      </TooltipContent>
    </Tooltip>

    <PreviewDialog
      v-model:open="open"
      v-model:index="index"
      :images="images"
      :title="images[index]?.title ?? ''"
    />
  </span>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import PreviewDialog, { type PreviewImage } from "@features/preview/index.vue"

defineProps<{ images: readonly PreviewImage[] }>()

const { t } = useI18n()
const open = ref(false)
const index = ref(0)

function show(i: number) {
  index.value = i
  open.value = true
}
</script>

<style scoped>
.tool-thumbs {
  position: relative;
  z-index: 1;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
}

/* 缩略图不超出所在行的行高，避免把单行工具行撑高 */
.tool-thumb {
  flex: none;
  height: calc(var(--text-meta) * var(--text-meta--line-height));
  aspect-ratio: 4 / 3;
  padding: 0;
  overflow: clip;
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  background: var(--bg);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  cursor: zoom-in;
  pointer-events: auto;
}

.tool-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>

<style>
/* tooltip 内容经 portal 到 body，scoped 打不中 */
.tool-thumb-tip {
  padding: var(--space-2xs);
}

.tool-thumb-tip img {
  display: block;
  max-inline-size: 280px;
  max-block-size: 280px;
  border-radius: var(--radius-control);
}
</style>
