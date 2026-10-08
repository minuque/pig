<template>
  <div class="queue-panel surface-float" role="list" :aria-label="t('composer.queueLabel')">
    <div
      v-for="(item, i) in items"
      :key="item.id"
      class="row"
      role="listitem"
      :class="{ 'is-dragging': item.id === draggingId }"
      draggable="true"
      @dragstart="onDragStart($event, item)"
      @dragover.prevent="onDragOver($event, i)"
      @drop.prevent="onDragEnd"
      @dragend="onDragEnd"
    >
      <GripVertical class="row-grip" aria-hidden="true" />
      <span class="row-text">{{ item.text }}</span>

      <span class="row-actions">
        <button
          type="button"
          class="action"
          :aria-label="t('composer.queueRemove', { text: item.text })"
          @click="emit('remove', item.id)"
        >
          <Trash2 class="action-icon" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="action"
          :aria-label="t('composer.queueEdit')"
          @click="emit('edit', item)"
        >
          <Pencil class="action-icon" aria-hidden="true" />
        </button>

        <button type="button" class="send-now" @click="emit('send-now', item)">
          {{ t("composer.queueSendNow") }}
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { GripVertical, Pencil, Trash2 } from "@lucide/vue"
import { useI18n } from "@i18n/index.js"
import type { QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"

const { t } = useI18n()
const props = defineProps<{
  items: QueuedPrompt[]
}>()
const emit = defineEmits<{
  reorder: [id: string, toIndex: number]
  edit: [item: QueuedPrompt]
  "send-now": [item: QueuedPrompt]
  remove: [id: string]
}>()
// HTML5 DnD 在 dragover 期间读不到 dataTransfer，拖拽源 id 存本地状态
const draggingId = ref<string>()

function onDragStart(e: DragEvent, item: QueuedPrompt) {
  draggingId.value = item.id
  e.dataTransfer?.setData("text/plain", item.id)

  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"
}

function onDragOver(e: DragEvent, index: number) {
  if (!draggingId.value) return
  const row = e.currentTarget

  if (!(row instanceof HTMLElement)) return

  const rect = row.getBoundingClientRect()
  const before = e.clientY < rect.top + rect.height / 2
  let to = before ? index : index + 1
  const from = props.items.findIndex((item) => item.id === draggingId.value)

  if (from < 0) return

  if (from < to) to -= 1

  if (to === from) return
  emit("reorder", draggingId.value, to)
}

function onDragEnd() {
  draggingId.value = undefined
}
</script>

<style scoped>
/* 托盘：左右内缩 16px，顶部 16px 圆角，底边 18px 垫在胶囊后面 */
.queue-panel {
  margin-inline: var(--spacing-md);
  margin-bottom: calc(-1 * 18px);
  padding: 0 var(--spacing-xs) 18px;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: inset 0 0 0 var(--border-width) var(--surface-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: 36px;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  color: var(--ink);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  cursor: default;
}

.row:hover {
  background: var(--hover-quiet);
}

.row.is-dragging {
  opacity: var(--opacity-disabled);
}

.row-grip {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--ink-muted);
  opacity: 0.5;
}

.row-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: none;
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  opacity: 0.72;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.action:hover {
  background: var(--hover-tint);
  color: var(--ink);
  opacity: 1;
}

.action-icon {
  width: 13px;
  height: 13px;
}

.send-now {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.send-now:hover {
  background: var(--hover-tint);
  color: var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  .action,
  .send-now {
    transition: none;
  }
}
</style>
