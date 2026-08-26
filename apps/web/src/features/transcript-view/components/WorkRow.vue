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
      <ChevronDown class="caret" :size="14" aria-hidden="true" />
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
import { ChevronDown } from "lucide-vue-next"
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
  margin-bottom: var(--spacing-lg);
}
.fold {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
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
  color: var(--ink-muted);
}
.fold-label {
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.005em;
  line-height: 18px;
}
.caret {
  flex: none;
  color: var(--ink-faint);
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.fold[aria-expanded="true"] .caret {
  transform: rotate(180deg);
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
