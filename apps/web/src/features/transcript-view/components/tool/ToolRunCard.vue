<template>
  <CardList class="tool-run-card">
    <CardRow v-for="entry in entries" :key="entry.id" bleed>
      <template #render="{ props: part }">
        <ToolThoughtRow
          v-bind="part"
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
    </CardRow>
  </CardList>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { CardList, CardRow } from "@pig/ui/card"
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
  --card-padding: 10px;
  --card-border-radius: var(--radius-card);

  min-width: 0;
  margin-block-start: var(--space-sm);
}

.tool-run-card > :deep(.tool-row) {
  padding: var(--space-sm) var(--card-padding);
}
</style>
