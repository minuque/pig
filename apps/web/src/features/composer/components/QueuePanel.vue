<template>
  <div
    ref="panel"
    class="queue-panel surface-float"
    role="list"
    :aria-label="t('composer.queueLabel')"
  >
    <div v-for="item in items" :key="item.id" class="row" role="listitem" :data-id="item.id">
      <GripVerticalIcon class="row-grip" aria-hidden="true" />
      <span class="row-text">{{ item.text }}</span>

      <span class="row-actions">
        <button
          type="button"
          class="action"
          :aria-label="t('composer.queueRemove', { text: item.text })"
          @click="emit('remove', item.id)"
        >
          <TrashIcon class="action-icon" aria-hidden="true" />
        </button>

        <button
          type="button"
          class="action"
          :aria-label="t('composer.queueEdit')"
          @click="emit('edit', item)"
        >
          <PenIcon class="action-icon" aria-hidden="true" />
        </button>

        <button type="button" class="send-now" @click="emit('sendNow', item)">
          {{ t("composer.queueSendNow") }}
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { useDragReorder } from "@utils/motion.js"
import type { QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"
import { GripVerticalIcon, PenIcon, TrashIcon } from "@components/icons/index.js"

const { t } = useI18n()

defineProps<{
  items: QueuedPrompt[]
}>()

const emit = defineEmits<{
  reorder: [id: string, toIndex: number]
  edit: [item: QueuedPrompt]
  sendNow: [item: QueuedPrompt]
  remove: [id: string]
}>()
const panel = useTemplateRef("panel")
const reorder = useDragReorder({
  axis: "y",
  container: () => panel.value,
  itemSelector: ".row",
  handleSelector: ".row-grip",
  onMove: (id, toIndex) => emit("reorder", id, toIndex),
})

onMounted(() => {
  const el = panel.value

  if (el) reorder.attach(el)
})

onBeforeUnmount(() => reorder.detach())
</script>

<style scoped>
.queue-panel {
  flex: 0 1 auto;
  min-block-size: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-inline: var(--space-md);
  margin-bottom: calc(-1 * 18px);
  padding: 0 var(--space-xs) 18px;
  border-radius: var(--radius-dialog) var(--radius-dialog) 0 0;
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  height: 36px;
  padding-inline: var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  cursor: default;
  touch-action: pan-y;
}

.row:hover {
  background: var(--bg-hover);
}

.row.is-drag-live {
  z-index: var(--z-sticky);
  background: var(--bg-surface);
  box-shadow: var(--shadow-popover);
  cursor: grabbing;
}

.row-grip {
  flex: none;
  width: var(--icon-md);
  height: var(--icon-md);
  color: var(--fg-muted);
  cursor: grab;
  touch-action: none;
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
  gap: var(--space-2xs);
  flex: none;
}

.action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--control-sm);
  height: var(--control-sm);
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-secondary);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.action:hover {
  background: var(--bg-hover);
  color: var(--fg);
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
  height: var(--control-sm);
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.send-now:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

@media (prefers-reduced-motion: reduce) {
  .action,
  .send-now {
    transition: none;
  }
}
</style>
