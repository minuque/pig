<template>
  <Collapsible :open="open" class="extension-message">
    <button
      type="button"
      class="extension-head"
      :aria-expanded="open"
      @click="emit('toggle', !open)"
    >
      <PuzzleIcon class="size-icon" aria-hidden="true" />
      <span class="extension-type">{{ row.customType }}</span>
      <span v-if="!open && firstLine" class="extension-first">· {{ firstLine }}</span>
      <ChevronRightIcon class="extension-chevron size-icon" aria-hidden="true" />
    </button>

    <CollapsibleContent>
      <div class="extension-body">
        <MarkdownContent v-if="row.text" :nodes="nodes" :streaming="false" />

        <div v-if="row.images.length" class="extension-images">
          <TranscriptImage
            v-for="(image, index) in row.images"
            :key="index"
            :data="image.data"
            :mime-type="image.mimeType"
          />
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Collapsible, CollapsibleContent } from "@pig/ui/collapsible"
import { ChevronRightIcon, PuzzleIcon } from "@components/icons/index.js"
import TranscriptImage from "@features/transcript-view/components/TranscriptImage.vue"
import MarkdownContent from "@features/transcript-view/components/markdown/MarkdownContent.vue"
import { useMarkdownNodes } from "@features/transcript-view/hooks/use-markdown-nodes.js"
import type { ExtensionRow } from "@features/transcript-view/type.js"

const props = defineProps<{ row: ExtensionRow; open: boolean }>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const firstLine = computed(() => props.row.text.trim().split("\n", 1)[0] ?? "")
const nodes = useMarkdownNodes({
  text: () => props.row.text,
  streaming: () => false,
  cacheKey: () => `extension:${props.row.id}`,
})
</script>

<style scoped>
.extension-head {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  inline-size: 100%;
  min-inline-size: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-muted);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.extension-type {
  color: var(--fg-secondary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.extension-first {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-chevron {
  flex: none;
  transition: transform var(--duration-fast) var(--ease-out);
}

.extension-head:hover,
.extension-head:hover .extension-type,
.extension-head[aria-expanded="true"],
.extension-head[aria-expanded="true"] .extension-type {
  color: var(--fg);
}

.extension-head[aria-expanded="true"] .extension-chevron {
  transform: rotate(90deg);
}

.extension-body {
  margin-block-start: var(--space-xs);
}

.extension-images {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-block-start: var(--space-xs);
}
</style>
