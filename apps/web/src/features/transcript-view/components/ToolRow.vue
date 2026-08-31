<template>
  <div class="tool-row" :class="{ folding: folded }">
    <button
      v-if="folded"
      type="button"
      class="fold"
      :class="{ open: revealed }"
      @click="emit('toggle-fold')"
    >
      <span class="fold-label">{{ label }}</span>
      <ChevronRight class="caret caret-hint" :size="14" />
    </button>
    <div class="body" :class="{ open: revealed }">
      <div class="steps" :class="{ wait: waiting }">
        <div v-if="waiting" class="waiting">
          <ThinkingOrb />
          <span>Thinking…</span>
        </div>
        <template v-else>
          <template v-for="step in steps" :key="step.type === 'tool' ? step.item.id : step.id">
            <ThinkCard
              v-if="step.type === 'thought'"
              :text="step.text"
              :streaming="step.streaming"
              :open="thinkCardOpen(step.id, expandedTools)"
              @update:open="emit('toggle-tool', step.id, $event)"
            />
            <ToolCall
              v-else
              :item="step.item"
              :open="toolCardOpen(step.item, expandedTools)"
              @update:open="emit('toggle-tool', step.item.id, $event)"
            />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronRight } from "lucide-vue-next"
import ThinkCard from "@features/transcript-view/components/ThinkCard.vue"
import ThinkingOrb from "@features/transcript-view/components/ThinkingOrb.vue"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import {
  thinkCardOpen,
  toolCardOpen,
  toolRowLabel,
  toolRowSteps,
  type ToolRow,
} from "@features/transcript-view/lib/transcript-rows.js"

const props = defineProps<{
  row: ToolRow
  foldOpen: boolean
  expandedTools: Map<string, boolean>
}>()

const emit = defineEmits<{
  "toggle-fold": []
  "toggle-tool": [id: string, open: boolean]
}>()

const folded = computed(() => props.row.mode === "fold")
const revealed = computed(() => !folded.value || props.foldOpen)
const waiting = computed(
  () =>
    props.row.mode === "live" && props.row.tools.length === 0 && props.row.thinking.length === 0,
)
const label = computed(() => toolRowLabel(props.row))
const steps = computed(() => toolRowSteps(props.row))
</script>

<style scoped>
.tool-row {
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
}
.body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-fast) var(--ease-out);
}
.body.open {
  grid-template-rows: 1fr;
}
.tool-row:not(.folding) .body {
  transition-duration: 0ms;
}
.folding .body.open {
  transition-duration: var(--duration-slow);
}
.steps {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-top: 2px;
  margin-inline-start: 6px;
  padding-inline-start: 20px;
  position: relative;
}
.steps.wait {
  margin-inline-start: 0;
  padding-inline-start: 0;
}
.steps:not(.wait)::before {
  content: "";
  position: absolute;
  inset-inline-start: 6px;
  top: 4px;
  bottom: 10px;
  width: 1px;
  background: var(--transcript-guide);
  pointer-events: none;
}
.steps > :deep(.call) {
  position: relative;
}
.waiting {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: 18px;
}
@media (prefers-reduced-motion: reduce) {
  .body {
    transition: none;
  }
}
</style>
