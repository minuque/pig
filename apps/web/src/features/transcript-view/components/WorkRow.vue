<template>
  <div class="work">
    <button
      v-if="folded"
      type="button"
      class="fold"
      :class="{ open: revealed }"
      @click="emit('toggle-fold')"
    >
      <span class="fold-label">{{ label }}</span>
      <ChevronRight class="caret" :size="14" />
    </button>
    <div v-if="revealed" class="body">
      <template v-for="step in steps" :key="step.type === 'tool' ? step.item.id : step.id">
        <ThinkCard
          v-if="step.type === 'thought'"
          :text="step.text"
          :streaming="step.streaming"
          :open="thinkCardOpen(step.id, step.streaming, expandedTools)"
          @update:open="emit('toggle-tool', step.id, $event)"
        />
        <ToolCall
          v-else
          :item="step.item"
          :open="toolCardOpen(step.item, expandedTools)"
          @update:open="emit('toggle-tool', step.item.id, $event)"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronRight } from "lucide-vue-next"
import ThinkCard from "@features/transcript-view/components/ThinkCard.vue"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import {
  thinkCardOpen,
  toolCardOpen,
  workFoldLabel,
  workSteps,
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
const steps = computed(() => workSteps(props.row))
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
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
}
.caret {
  flex: none;
  color: inherit;
  opacity: 0;
  transition:
    transform var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth);
}
.fold:hover .caret,
.fold.open .caret {
  opacity: 0.7;
}
.fold.open .caret {
  transform: rotate(90deg);
}
.body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-top: 2px;
  margin-inline-start: 6px;
}
.body > :deep(.call) {
  position: relative;
  padding-inline-start: 20px;
}
.body > :deep(.call)::before {
  content: "";
  position: absolute;
  inset-inline-start: 6px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--hairline);
  pointer-events: none;
}
.body > :deep(.call:last-child)::before {
  box-sizing: border-box;
  width: 10px;
  height: 11px;
  bottom: auto;
  background: none;
  border-inline-start: var(--border-width) solid var(--hairline);
  border-bottom: var(--border-width) solid var(--hairline);
  border-end-start-radius: var(--radius-md);
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
}
</style>
