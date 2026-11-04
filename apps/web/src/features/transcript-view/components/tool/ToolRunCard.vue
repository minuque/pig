<template>
  <div class="tool-run-card">
    <ToolRow
      v-for="call in calls"
      :key="call.id"
      :call="call"
      :open="expandedTools.get(call.id) ?? false"
      @toggle="emit('toggleTool', call.id, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import ToolRow from "@features/transcript-view/components/tool/ToolRow.vue"
import type { ToolCallView } from "@features/transcript-view/type.js"

defineProps<{
  calls: readonly ToolCallView[]
  expandedTools: Map<string, boolean>
}>()

const emit = defineEmits<{ toggleTool: [id: string, open: boolean] }>()
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
