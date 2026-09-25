<template>
  <div
    class="completion-popup glass"
    role="listbox"
    :aria-label="kind === 'mention' ? '文件补全' : '命令补全'"
  >
    <template v-if="loading">
      <div v-for="n in 3" :key="n" class="row row--skeleton" aria-hidden="true">
        <span class="skeleton-icon" />
        <span class="skeleton-line" />
      </div>
    </template>

    <template v-else-if="items.length">
      <button
        v-for="(item, i) in items"
        :key="item.id"
        type="button"
        class="row"
        :class="{ 'is-active': i === index }"
        role="option"
        :aria-selected="i === index"
        @mouseenter="emit('hover', i)"
        @click="emit('pick', i)"
      >
        <component :is="iconOf(item.icon)" class="row-icon" aria-hidden="true" />
        <span class="row-label">{{ item.label }}</span>
        <span class="row-detail">{{ item.detail }}</span>
      </button>
    </template>

    <p v-else class="empty">{{ emptyText }}</p>
  </div>
</template>

<script setup lang="ts">
import { FileCode, FileImage, FileText, Slash } from "@lucide/vue"
import type {
  CompletionItem,
  CompletionKind,
} from "@features/composer/hooks/use-composer-completion.js"

defineProps<{
  kind: CompletionKind
  items: CompletionItem[]
  index: number
  loading: boolean
  emptyText: string
}>()

const emit = defineEmits<{
  pick: [index: number]
  hover: [index: number]
}>()

function iconOf(icon: CompletionItem["icon"]) {
  switch (icon) {
    case "file-code":
      return FileCode
    case "image":
      return FileImage
    case "command":
      return Slash
    default:
      return FileText
  }
}
</script>

<style scoped>
.completion-popup {
  position: absolute;
  inset-inline: var(--spacing-md);
  /* 浮在胶囊上方，占满胶囊宽（zeron 补全弹层贴 pill 顶边） */
  bottom: calc(100% + var(--spacing-xs));
  z-index: var(--z-drawer);
  max-height: 17.5rem;
  overflow-y: auto;
  padding: var(--spacing-xxs);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-popover);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: 40px;
  padding: 0 var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
  text-align: start;
  cursor: pointer;
}

.row.is-active {
  background: var(--hover-tint);
}

.row-icon {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--ink-faint);
}

.row-label {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: start;
}

.row--skeleton {
  pointer-events: none;
}

.skeleton-icon,
.skeleton-line {
  display: block;
  border-radius: var(--radius-sm);
  background: var(--hover-quiet);
  animation: completion-pulse var(--duration-slow) var(--ease-in-out) infinite alternate;
}

.skeleton-icon {
  width: var(--size-icon);
  height: var(--size-icon);
}

.skeleton-line {
  flex: 1;
  height: 0.75rem;
}

.empty {
  margin: 0;
  padding: var(--spacing-sm);
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-align: center;
}

@keyframes completion-pulse {
  to {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-icon,
  .skeleton-line {
    animation: none;
  }
}
</style>
