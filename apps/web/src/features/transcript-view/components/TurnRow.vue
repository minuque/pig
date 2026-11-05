<template>
  <div class="turn" :data-turn-id="turn.id">
    <div
      v-for="row in turn.rows"
      :key="row.id"
      class="row"
      :class="`row-${row.role}`"
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

      <ToolRun
        v-else-if="isToolRow(row)"
        :row="row"
        :expanded="isExpand(row.id)"
        :expanded-tools="expandedTools"
        @toggle-expand="emit('toggleExpand', row.id, $event)"
        @toggle-tool="(id, open) => emit('toggleTool', row.id, id, open)"
      />
    </div>

    <TurnErrorRow v-if="turnError" class="turn-error-row" v-bind="turnError" />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TurnErrorRow from "@features/transcript-view/components/TurnErrorRow.vue"
import ToolRun from "@features/transcript-view/components/tool/ToolRun.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { isToolRow } from "@features/transcript-view/lib/transcript-rows.js"
import type { TimelineTurn } from "@features/transcript-view/type.js"

const props = defineProps<{
  turn: TimelineTurn
  sessionId: string
  running: boolean
  isExpand: (id: string) => boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  toggleExpand: [id: string, open: boolean]
  toggleTool: [rowId: string, id: string, open: boolean]
}>()
/** 一轮的错误只保留一条：从末尾找最近一次带错误状态的助手行。 */
const turnError = computed(() => {
  for (let index = props.turn.rows.length - 1; index >= 0; index -= 1) {
    const row = props.turn.rows[index]

    if (row?.role !== "assistant" || (!row.error && !row.aborted)) continue
    return {
      error: row.error,
      message: row.errorMessage,
      retryCount: row.retryCount,
    }
  }

  return null
})
</script>

<style scoped>
.turn {
  box-sizing: border-box;
  width: 100%;
}

.turn + .turn {
  margin-block-start: var(--transcript-turn-gap);
}

.row {
  box-sizing: border-box;
  width: 100%;
}

.row + .row {
  margin-block-start: var(--transcript-item-gap);
}

.turn-error-row {
  margin-block-start: var(--transcript-item-gap);
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
