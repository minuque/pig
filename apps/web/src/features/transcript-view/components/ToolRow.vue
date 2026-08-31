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
    <div class="body" :class="{ open: bodyOpen }">
      <div class="steps" :class="{ wait: waiting }">
        <template v-if="!waiting">
          <template v-for="step in steps" :key="step.type === 'tool' ? step.item.id : step.id">
            <ThinkCard
              v-if="step.type === 'thought'"
              :text="step.text"
              :streaming="step.streaming"
              :open="expandedTools.get(step.id) === true"
              @update:open="emit('toggle-tool', step.id, $event)"
            />
            <ToolCall
              v-else
              :item="step.item"
              :open="expandedTools.get(step.item.id) === true"
              @update:open="emit('toggle-tool', step.item.id, $event)"
            />
          </template>
        </template>
        <div v-if="live" class="waiting">
          <ThinkingOrb />
          <ThinkingState :text="sentinelText" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { ChevronRight } from "lucide-vue-next"
import ThinkCard from "@features/transcript-view/components/ThinkCard.vue"
import ThinkingOrb from "@features/transcript-view/components/ThinkingOrb.vue"
import ThinkingState from "@features/transcript-view/components/ThinkingState.vue"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import {
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
const live = computed(() => props.row.mode === "live")
const revealed = computed(() => !folded.value || props.foldOpen)
const bodyOpen = ref(revealed.value)
const waiting = computed(
  () => live.value && props.row.tools.length === 0 && props.row.thinking.length === 0,
)
const sentinelText = computed(() => (props.row.tools.length > 0 ? "正在执行" : "思考中"))
const label = computed(() => toolRowLabel(props.row))
const steps = computed(() => toolRowSteps(props.row))

watch(
  revealed,
  (open) => {
    if (open) {
      bodyOpen.value = true
      return
    }
    requestAnimationFrame(() => {
      bodyOpen.value = false
    })
  },
  { flush: "sync" },
)
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
