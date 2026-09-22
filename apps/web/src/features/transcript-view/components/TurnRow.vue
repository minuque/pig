<template>
  <div class="turn" :data-turn-id="turn.id">
    <div
      v-for="(row, rowIndex) in turn.rows"
      :key="row.id"
      class="row"
      :class="rowClass(row, rowIndex)"
      :data-row-id="row.id"
      :data-minimap-row="row.role === 'user' ? row.id : undefined"
    >
      <UserMessage v-if="row.role === 'user'" :item="row" />

      <AssistantMessage
        v-else-if="row.role === 'assistant'"
        :item="row"
        :session-id="sessionId"
        :streaming="running && row.streaming"
      />

      <ToolSteps
        v-else-if="isToolRow(row)"
        :row="row"
        :is-expand="isExpand(row.id)"
        :expanded-tools="expandedTools"
        @toggle-expand="emit('toggle-expand', row.id, $event)"
        @toggle-tool="(id, open) => emit('toggle-tool', row.id, id, open)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import ToolSteps from "@features/transcript-view/components/ToolSteps.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { isToolRow } from "@features/transcript-view/lib/transcript-rows.js"
import type { TimelineRow, TimelineTurn } from "@features/transcript-view/type.js"

const props = defineProps<{
  turn: TimelineTurn
  first: boolean
  previousRole?: TimelineRow["role"] | undefined
  sessionId: string
  running: boolean
  isExpand: (id: string) => boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  "toggle-expand": [id: string, open: boolean]
  "toggle-tool": [rowId: string, id: string, open: boolean]
}>()

function rowClass(row: TimelineRow, rowIndex: number) {
  const previous = rowIndex > 0 ? props.turn.rows[rowIndex - 1] : undefined
  const previousRole = previous?.role ?? props.previousRole
  return [
    `row-${row.role}`,
    {
      "is-first": props.first && rowIndex === 0,
      "is-after-user": previousRole === "user",
    },
  ]
}
</script>

<style scoped>
.turn {
  box-sizing: border-box;
  width: 100%;
}

.row {
  box-sizing: border-box;
  width: 100%;
  padding-block-start: var(--spacing-md);
}

.row.is-after-user {
  padding-block-start: var(--spacing-lg);
}

.row.row-tools.is-after-user {
  padding-block-start: var(--spacing-md);
}

.row.row-user {
  padding-block-start: var(--spacing-xl);
}

.row.is-first {
  padding-block-start: 0;
}

.row :deep(.stamp) {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.row:hover :deep(.stamp),
.row:focus-within :deep(.stamp),
.row :deep(.stamp.is-copied),
.row :deep(.stamp.is-error) {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .row :deep(.stamp) {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
