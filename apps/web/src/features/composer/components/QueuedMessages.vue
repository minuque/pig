<template>
  <div class="queue">
    <div
      ref="rowsEl"
      class="rows"
      role="list"
      :aria-label="t('composer.queueLabel')"
      aria-live="polite"
    >
      <QueuedMessageRow
        v-for="item in shown"
        :key="item.id"
        :item="item"
        :editing="editingId === item.id"
        :can-up="canMove(item.id, -1)"
        :can-down="canMove(item.id, 1)"
        @move="emit('move', item.id, $event)"
        @edit="emit('edit', item)"
        @send-now="emit('sendNow', item)"
        @remove="emit('remove', item.id)"
        @preview="emit('preview', $event)"
      />
    </div>

    <button
      v-if="items.length > VISIBLE_ROWS"
      type="button"
      class="queue-toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{
        expanded
          ? t("composer.queueShowLess")
          : t("composer.queueShowAll", { count: items.length - VISIBLE_ROWS })
      }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { useDragReorder } from "@utils/motion.js"
import QueuedMessageRow from "@features/composer/components/QueuedMessageRow.vue"
import type { ComposerAttachment } from "@/types/attachment-type.js"
import type { QueuedPrompt } from "@features/composer/hooks/use-composer-queue.js"

const VISIBLE_ROWS = 3
const { t } = useI18n()
const props = defineProps<{ items: QueuedPrompt[]; editingId: string | null }>()
const emit = defineEmits<{
  reorder: [id: string, toIndex: number]
  move: [id: string, delta: -1 | 1]
  edit: [item: QueuedPrompt]
  sendNow: [item: QueuedPrompt]
  remove: [id: string]
  preview: [item: ComposerAttachment]
}>()
const rowsEl = useTemplateRef("rowsEl")
const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.items : props.items.slice(0, VISIBLE_ROWS)))
const drag = useDragReorder({
  axis: "y",
  container: () => rowsEl.value,
  itemSelector: ".row",
  handleSelector: ".row-grip",
  onMove: (id, toIndex) => emit("reorder", id, toIndex),
})

function canMove(id: string, delta: -1 | 1) {
  const index = props.items.findIndex((item) => item.id === id)
  return index >= 0 && index + delta >= 0 && index + delta < props.items.length
}

onMounted(() => {
  const el = rowsEl.value

  if (el) drag.attach(el)
})

onBeforeUnmount(() => drag.detach())
</script>

<style scoped>
.queue {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2xs);
  padding-block: var(--space-md) var(--space-xs);
}

.rows {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2xs);
  width: 100%;
}

.queue-toggle {
  padding: 0;
  border: 0;
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  cursor: pointer;
}

.queue-toggle:hover {
  color: var(--fg);
}
</style>
