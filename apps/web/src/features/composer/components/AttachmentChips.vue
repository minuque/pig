<template>
  <div class="chips">
    <div
      v-for="row in rows"
      :key="row.item.id"
      class="chip"
      :class="{ 'chip--file': !row.item.url }"
    >
      <button
        v-if="row.item.url"
        type="button"
        class="thumb-btn"
        :aria-label="`预览 ${row.item.name}`"
        @click="emit('preview', row.item)"
      >
        <img class="thumb" :src="row.item.url" :alt="row.item.name" />
      </button>

      <span v-else class="file">
        <FileText class="file-icon" aria-hidden="true" />

        <span class="file-name">
          <span class="file-base">{{ row.base }}</span>
          <span v-if="row.ext" class="file-ext">{{ row.ext }}</span>
        </span>
      </span>

      <button
        type="button"
        class="remove"
        :aria-label="`Remove ${row.item.name}`"
        @mousedown.prevent
        @click="emit('remove', row.item.id)"
      >
        <X class="remove-icon" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { FileText, X } from "@lucide/vue"
import type { ComposerAttachment } from "@features/composer/hooks/use-composer-attachments.js"

const props = defineProps<{
  files: ComposerAttachment[]
}>()
const emit = defineEmits<{
  remove: [id: string]
  preview: [item: ComposerAttachment]
}>()
/** 扩展名单独一段，截断只吃主名，扩展名始终可见。 */
const rows = computed(() =>
  props.files.map((item) => {
    const dot = item.name.lastIndexOf(".")
    const split = dot > 0 ? item.name.slice(dot) : ""
    return { item, base: split ? item.name.slice(0, dot) : item.name, ext: split }
  }),
)
</script>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  min-width: 0;
}

.chip {
  position: relative;
  flex: none;
  width: 56px;
  height: 56px;
  overflow: visible;
  border-radius: var(--radius-md);
  background: var(--hover-quiet);
}

.chip--file {
  width: auto;
  max-width: 12rem;
  overflow: visible;
}

.thumb-btn {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: inherit;
  overflow: hidden;
  background: transparent;
  cursor: zoom-in;
}

.thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  outline: var(--border-width) solid var(--media-outline);
  outline-offset: -1px;
}

.file {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 100%;
  /* 右内边距让开右上角移除钮 */
  padding-inline: var(--spacing-sm) var(--spacing-lg);
  color: var(--ink-secondary);
}

.file-icon {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--ink-faint);
}

.file-name {
  display: flex;
  min-width: 0;
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}

.file-base {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-ext {
  flex: none;
  color: var(--ink-faint);
}

.remove {
  position: absolute;
  inset-block-start: calc(-1 * var(--spacing-xxs));
  inset-inline-end: calc(-1 * var(--spacing-xxs));
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--inverse-bg);
  color: var(--inverse-fg);
  cursor: pointer;
  opacity: 0;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth);
}

/* 悬在缩略图外沿，不裁切；hover / 键盘焦点时浮出 */
.chip:hover .remove,
.chip:focus-within .remove {
  opacity: 1;
}

.remove:hover,
.remove:focus-visible {
  background: var(--inverse-bg-hover);
  opacity: 1;
}

.remove-icon {
  width: 12px;
  height: 12px;
  stroke-width: 2.5px;
}

@media (prefers-reduced-motion: reduce) {
  .remove {
    transition: none;
  }
}
</style>
