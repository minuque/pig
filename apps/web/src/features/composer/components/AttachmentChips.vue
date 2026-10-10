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
        <DocumentIcon class="file-icon" aria-hidden="true" />

        <span class="file-name">
          <span class="file-base">{{ row.base }}</span>
          <span v-if="row.ext" class="file-ext">{{ row.ext }}</span>
        </span>
      </span>

      <!-- 上传环：pathLength=100，dasharray 一段即进度，描 tile 圆角边。
           进度 0 不画：round 线帽会在零长 dash 处留一个多余圆点。 -->
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
        <CloseIcon class="remove-icon" aria-hidden="true" />
      </button>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import type { ComposerAttachment } from "@features/composer/hooks/use-composer-attachments.js"
import { CloseIcon, DocumentIcon } from "@components/icons/index.js"

const { t } = useI18n()
const props = defineProps<{
  files: ComposerAttachment[]
  /** 发送中各附件的上传进度 0–100；无此项即未在上传。 */
  progress?: ReadonlyMap<string, number> | undefined
}>()
const emit = defineEmits<{
  remove: [id: string]
  preview: [item: ComposerAttachment]
}>()
/**
 * 56×56 tile 的描边路径，与 tile 同位同圆角（radius-md=8，边距 1px 让 2px
 * 描边中线压 tile 边缘）。pathLength=100 让 dasharray 一段即进度。
 */
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

/** 扩展名单独一段，截断只吃主名，扩展名始终可见。 */
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
  gap: var(--spacing-xs);
  min-width: 0;
}

/* 所有附件统一 56px tile：环才能贴边描圆角 */
.chip {
  position: relative;
  flex: none;
  width: 56px;
  height: 56px;
  overflow: visible;
  border-radius: var(--radius-md);
  background: var(--hover-quiet);
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
  outline: var(--border-width) solid var(--media-outline);
  outline-offset: -1px;
}

/* 上传中内容压低，让环突出 */
.chip--uploading .thumb-btn,
.chip--uploading .file {
  opacity: 0.6;
}

/* 图片环压边时撤掉缩略图自身描边，避免与环叠成双线（文件卡无描边，底色保留） */
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
  padding: var(--spacing-xs) 3px 0;
  color: var(--ink-secondary);
  transition: opacity var(--duration-normal) var(--ease-out);
}

.file-icon {
  flex: none;
  width: 24px;
  height: 24px;
  color: var(--ink-faint);
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
  color: var(--ink-faint);
}

/* 进度环与 tile 同位：描边中线压 tile 边缘，不再外扩出第二道框。
   类名不用 ring：Tailwind v4 的 ring 工具类会给 svg 加直角 box-shadow。 */
.upload-ring {
  position: absolute;
  inset: 0;
  width: 56px;
  height: 56px;
  pointer-events: none;
  color: var(--primary);
}

.upload-ring path {
  stroke: currentcolor;
  transition: stroke-dasharray 120ms linear;
}

/* 上传中右上角百分比；非图片 tile 用主题色，图片 tile 白字压图 */
.pct {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-end: 3px;
  font-size: 9px;
  line-height: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--primary);
  pointer-events: none;
}

/* 图片 tile：磨砂墨底 + 反差字，压得住任意缩略图 */
.chip:not(.chip--file) .pct {
  padding: 0 3px;
  border-radius: var(--radius-full);
  background: var(--inverse-bg);
  color: var(--inverse-fg);
  backdrop-filter: blur(2px);
}

/* 删除钮与百分比占同一角，做 opacity+blur 交叉切换 */
.remove {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-end: 3px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--inverse-bg);
  color: var(--inverse-fg);
  cursor: pointer;
  opacity: 0;
  filter: blur(3px);
  transition:
    background var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth),
    filter var(--duration-fast) var(--ease-smooth);
}

/* hover / 键盘焦点时浮出；上传中让位给百分比 */
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
  background: var(--inverse-bg-hover);
}

.remove-icon {
  width: 11px;
  height: 11px;
  stroke-width: 2.5px;
}

/* 入场 / 退场：scale + blur，与 BoardUI tile 同一手感 */
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
