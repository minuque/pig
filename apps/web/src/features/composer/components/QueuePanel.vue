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
          <TrashBinMinimalisticIcon class="action-icon" aria-hidden="true" />
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
import { GripVerticalIcon, PenIcon, TrashBinMinimalisticIcon } from "@components/icons/index.js"

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
/* 托盘：左右内缩 16px，顶部 16px 圆角，底边 18px 垫在胶囊后面 */
.queue-panel {
  margin-inline: var(--space-md);
  margin-bottom: calc(-1 * 18px);
  padding: 0 var(--space-xs) 18px;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  box-shadow: inset 0 0 0 var(--border-width) var(--card-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  height: 36px;
  padding-inline: var(--space-xs);
  border-radius: var(--radius-md);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  cursor: default;
  touch-action: pan-y;
}

.row:hover {
  background: var(--hover-quiet);
}

/* 拖拽跟手：源行保持实体阴影，邻项让位由 useDragReorder 的 transform 预览驱动 */
.row.is-drag-live {
  z-index: 2;
  background: var(--card);
  box-shadow: var(--shadow-float);
  cursor: grabbing;
}

.row-grip {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--contrast-foreground);
  opacity: 0.5;
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
  gap: var(--space-xxs);
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
  color: var(--contrast-foreground);
  opacity: 0.72;
  cursor: pointer;
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.action:hover {
  background: var(--hover-tint);
  color: var(--contrast-foreground);
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
  color: var(--contrast-foreground);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.send-now:hover {
  background: var(--hover-tint);
  color: var(--contrast-foreground);
}

@media (prefers-reduced-motion: reduce) {
  .action,
  .send-now {
    transition: none;
  }
}
</style>
