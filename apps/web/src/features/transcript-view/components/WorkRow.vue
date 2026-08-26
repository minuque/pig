<template>
  <div class="work">
    <button
      v-if="folded"
      type="button"
      class="fold"
      :aria-expanded="revealed"
      :aria-label="label"
      @click="emit('toggle-fold')"
    >
      <span class="fold-label">{{ label }}</span>
      <ChevronRight class="caret" :size="14" aria-hidden="true" />
    </button>
    <div v-if="revealed" class="body">
      <ThinkingBlocks
        v-if="row.thinking.length"
        :blocks="row.thinking"
        :streaming="row.thinkingStreaming"
      />
      <ToolCall
        v-for="tool in row.tools"
        :key="tool.id"
        :item="tool"
        :open="toolCardOpen(tool, expandedTools)"
        @update:open="emit('toggle-tool', tool.id, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronRight } from "lucide-vue-next"
import ThinkingBlocks from "@features/transcript-view/components/ThinkingBlocks.vue"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import {
  toolCardOpen,
  workFoldLabel,
  type WorkRow,
} from "@features/transcript-view/lib/transcript-rows.js"

const props = defineProps<{
  row: WorkRow
  foldOpen: boolean
  expandedTools: Map<string, boolean>
}>()

const emit = defineEmits<{
  "toggle-fold": []
  "toggle-tool": [id: string, open: boolean]
}>()

const folded = computed(() => props.row.mode === "fold")
const revealed = computed(() => !folded.value || props.foldOpen)
const label = computed(() => workFoldLabel(props.row))
</script>

<style scoped>
.work {
  contain: layout style;
  margin-bottom: var(--spacing-md);
}
.fold {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}
.fold:focus {
  outline: none;
}
.fold:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: var(--focus-ring-width);
}
.fold:hover .fold-label,
.fold:hover .caret {
  color: var(--ink-secondary);
}
.fold-label {
  color: inherit;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-body-sm--line-height);
}
.caret {
  flex: none;
  color: inherit;
  opacity: 0.7;
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.fold[aria-expanded="true"] .caret {
  transform: rotate(90deg);
}
.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
}
</style>
