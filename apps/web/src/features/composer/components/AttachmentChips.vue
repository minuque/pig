<template>
  <TransitionGroup tag="div" name="chip" class="chips">
    <div
      v-for="row in rows"
      :key="row.item.id"
      class="chip"
      :class="{ 'chip--file': !row.item.url, 'chip--uploading': row.uploading }"
    >
      <button
        v-if="row.item.url"
        type="button"
        class="thumb-btn"
        :aria-label="t('common.preview', { name: row.item.name })"
        @click="emit('preview', row.item)"
      >
        <img class="thumb" :src="row.item.url" :alt="row.item.name" />
      </button>

      <span v-else class="file">
        <FileTextIcon class="file-icon" aria-hidden="true" />

        <span class="file-name">
          <span class="file-base">{{ row.base }}</span>
          <span v-if="row.ext" class="file-ext">{{ row.ext }}</span>
        </span>
      </span>

      <!-- 外部：round 线帽在零长 dash 处会留一个多余圆点，进度 0 不画环 -->
      <svg
        v-if="row.uploading && (row.progress ?? 0) > 0"
        class="upload-ring"
        viewBox="0 0 56 56"
        aria-hidden="true"
      >
        <path
          :d="ringPath"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          pathLength="100"
          :stroke-dasharray="`${row.progress ?? 0} 200`"
        />
      </svg>

      <span v-if="row.uploading" class="pct" aria-hidden="true">
        {{ Math.round(row.progress ?? 0) }}%
      </span>

      <button
        type="button"
        class="remove"
        :aria-label="t('common.remove', { name: row.item.name })"
        @mousedown.prevent
        @click="emit('remove', row.item.id)"
      >
        <XIcon class="remove-icon" aria-hidden="true" />
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import { XIcon, FileTextIcon } from "@components/icons/index.js"

const { t } = useI18n()
const props = defineProps<{
  files: ComposerAttachment[]
  progress?: ReadonlyMap<string, number> | undefined
}>()
const emit = defineEmits<{
  remove: [id: string]
  preview: [item: ComposerAttachment]
}>()
const ringPath = [
  "M 28 1",
  "H 47",
  arc(55, 9),
  "V 47",
  arc(47, 55),
  "H 9",
  arc(1, 47),
  "V 9",
  arc(9, 1),
  "Z",
].join(" ")

function arc(x: number, y: number): string {
  return `A 8 8 0 0 1 ${x} ${y}`
}

const rows = computed(() =>
  props.files.map((item) => {
    const dot = item.name.lastIndexOf(".")
    const split = dot > 0 ? item.name.slice(dot) : ""
    const value = props.progress?.get(item.id)
    return {
      item,
      base: split ? item.name.slice(0, dot) : item.name,
      ext: split,
      uploading: value !== undefined,
      progress: value,
    }
  }),
)
</script>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  min-width: 0;
}

.chip {
  position: relative;
  flex: none;
  width: 56px;
  height: 56px;
  overflow: visible;
  border-radius: var(--radius-control);
  background: var(--bg-muted);
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
  transition: opacity var(--duration-normal) var(--ease-out);
}

.thumb {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  outline: var(--border-width) solid var(--border-subtle);
  outline-offset: -1px;
}

.chip--uploading .thumb-btn,
.chip--uploading .file {
  opacity: 0.6;
}

.chip--uploading .thumb {
  outline: none;
}

.file {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  height: 100%;
  padding: var(--space-xs) 3px 0;
  color: var(--fg-secondary);
  transition: opacity var(--duration-normal) var(--ease-out);
}

.file-icon {
  flex: none;
  width: 24px;
  height: 24px;
  color: var(--fg-secondary);
}

.file-name {
  display: flex;
  width: 100%;
  justify-content: center;
  font-size: 9px;
  line-height: 13px;
  letter-spacing: 0.2px;
}

.file-base {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-ext {
  flex: none;
  color: var(--fg-secondary);
}

.upload-ring {
  position: absolute;
  inset: 0;
  width: 56px;
  height: 56px;
  pointer-events: none;
  color: var(--accent-text);
}

.upload-ring path {
  stroke: currentcolor;
  transition: stroke-dasharray 120ms linear;
}

.pct {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-end: 3px;
  font-size: 9px;
  line-height: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--accent-text);
  pointer-events: none;
}

.chip:not(.chip--file) .pct {
  padding: 0 3px;
  border-radius: var(--radius-pill);
  background: var(--bg-inverse);
  color: var(--fg-inverse);
}

.remove {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-end: 3px;
  z-index: var(--z-raise);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--bg-inverse);
  color: var(--fg-inverse);
  cursor: pointer;
  opacity: 0;
  filter: blur(3px);
  transition:
    background var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out),
    filter var(--duration-fast) var(--ease-out);
}

.chip:hover .remove,
.chip:focus-within .remove {
  opacity: 1;
  filter: blur(0);
}

.chip--uploading .remove,
.chip--uploading:hover .remove,
.chip--uploading:focus-within .remove {
  opacity: 0;
  filter: blur(3px);
  pointer-events: none;
}

.remove:hover,
.remove:focus-visible {
  background: var(--bg-inverse-hover);
}

.remove-icon {
  width: 11px;
  height: 11px;
  stroke-width: 2.5px;
}

.chip-enter-active,
.chip-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    scale var(--duration-normal) var(--ease-out),
    filter var(--duration-normal) var(--ease-out);
}

.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  scale: 0.8;
  filter: blur(4px);
}

.chip-move {
  transition: transform var(--duration-normal) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .remove,
  .thumb-btn,
  .file,
  .upload-ring path,
  .chip-enter-active,
  .chip-leave-active,
  .chip-move {
    transition: none;
  }
}
</style>
