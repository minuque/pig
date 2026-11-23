<template>
  <span v-if="images.length" class="tool-thumbs">
    <Tooltip v-for="(image, i) in shown" :key="i" :delay="150">
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

    <button
      v-if="rest"
      type="button"
      class="tool-thumb-more"
      :aria-label="t('common.preview', { name: images[MAX]!.title })"
      @click.stop="show(MAX)"
    >
      +{{ rest }}
    </button>

    <PreviewDialog
      v-model:open="open"
      v-model:index="index"
      :images="images"
      :title="images[index]?.title ?? ''"
    />
  </span>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import PreviewDialog, { type PreviewImage } from "@features/preview/index.vue"

const MAX = 3
const props = defineProps<{ images: readonly PreviewImage[] }>()
const shown = computed(() => props.images.slice(0, MAX))
const rest = computed(() => Math.max(0, props.images.length - MAX))
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
  z-index: var(--z-raise);
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
}

.tool-thumb-more {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  cursor: zoom-in;
  pointer-events: auto;
}

.tool-thumb-more:hover {
  color: var(--fg);
}

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
