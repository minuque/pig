<template>
  <div class="tool-run-card">
    <template v-for="entry in entries" :key="entry.id">
      <ToolThoughtRow
        v-if="entry.kind === 'thought'"
        :step="entry.step"
        :open="expandedTools.get(entry.id) ?? false"
        @toggle="emit('toggleTool', entry.id, $event)"
      />

      <ToolRow
        v-else
        :call="entry.call"
        :open="expandedTools.get(entry.call.id) ?? false"
        @toggle="emit('toggleTool', entry.call.id, $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import ToolRow from "@features/transcript-view/components/tool/ToolRow.vue"
import ToolThoughtRow from "@features/transcript-view/components/tool/ToolThoughtRow.vue"
import type {
  ThoughtStep,
  ToolCallView,
  ToolRow as ToolRowModel,
} from "@features/transcript-view/type.js"

type RunEntry =
  | { kind: "thought"; id: string; step: ThoughtStep }
  | { kind: "tool"; id: string; call: ToolCallView }

const props = defineProps<{
  row: ToolRowModel
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{ toggleTool: [id: string, open: boolean] }>()
/** 按步骤顺序展开：思考块和工具调用共用同一份展开状态表。 */
const entries = computed<RunEntry[]>(() =>
  props.row.steps.flatMap((step): RunEntry[] =>
    step.type === "thought"
      ? [{ kind: "thought", id: step.id, step }]
      : step.items.map((call) => ({ kind: "tool", id: call.id, call })),
  ),
)
</script>

<style scoped>
.tool-run-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-block-start: var(--space-sm);
  border-radius: var(--radius-md);
  overflow: clip;
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

.tool-run-card > :deep(.tool-row) {
  padding: var(--space-sm) var(--transcript-row-pad);
}

.tool-run-card > :deep(.tool-row + .tool-row) {
  border-block-start: var(--border-width) solid var(--border);
}
</style>
