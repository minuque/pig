<template>
  <div class="queue">
    <SortableList
      v-slot="{ state }"
      class="rows"
      :aria-label="t('composer.queueLabel')"
      aria-live="polite"
      :value="ids"
      :item-label="labelOf"
      :message="announce"
      @value-change="onReorder"
    >
      <QueuedMessageRow
        v-for="item in visible(state.order)"
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
    </SortableList>

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
import { computed, ref } from "vue"
import { useI18n } from "@i18n/index.js"
import { SortableList, type ReorderMessage } from "@pig/ui/sortable-list"
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
const expanded = ref(false)
const ids = computed(() => props.items.map((item) => item.id))
const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))

function visible(order: string[]): QueuedPrompt[] {
  const rows = order.flatMap((id) => byId.value.get(id) ?? [])
  return expanded.value ? rows : rows.slice(0, VISIBLE_ROWS)
}

function labelOf(id: string): string | undefined {
  const item = byId.value.get(id)
  return item?.text || item?.attachmentsPreview.map((file) => file.name).join(", ")
}

function announce(message: ReorderMessage): string {
  const params = { label: message.label, position: message.position, total: message.total }

  if (message.type === "grab") return t("composer.queueGrab", params)

  if (message.type === "move") return t("composer.queueMoveTo", params)

  if (message.type === "drop") return t("composer.queueDrop", params)
  return t("composer.queueCancel", params)
}

function onReorder(next: string[]) {
  const rest = (order: string[], key: string) => order.filter((id) => id !== key).join(" ")
  const moved = next.find(
    (key, index) => key !== ids.value[index] && rest(next, key) === rest(ids.value, key),
  )

  if (moved) emit("reorder", moved, next.indexOf(moved))
}

function canMove(id: string, delta: -1 | 1) {
  const index = props.items.findIndex((item) => item.id === id)
  return index >= 0 && index + delta >= 0 && index + delta < props.items.length
}
</script>

<style scoped>
.queue {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2xs);
  margin-block-start: auto;
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
