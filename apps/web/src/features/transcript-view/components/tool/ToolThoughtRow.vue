<template>
  <Collapsible as-child :open="open" @update:open="emit('toggle', $event)">
    <div class="tool-row">
      <CollapsibleTrigger as-child>
        <button type="button" class="tool-row-trigger">
          <span
            class="thought-label"
            :class="{ shimmer: step.streaming }"
            :data-text="step.streaming ? label : undefined"
          >
            {{ label }}
          </span>

          <ChevronRightIcon class="thought-caret" :class="{ 'is-open': open }" data-icon="inline" />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent class="thought-body">
        <ToolOutput :text="step.text" soft-wrap />
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ChevronRightIcon } from "@components/icons/index.js"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import ToolOutput from "@features/transcript-view/components/ToolOutput.vue"
import { thoughtStepLabel } from "@features/transcript-view/lib/transcript-row-label.js"
import type { ThoughtStep } from "@features/transcript-view/type.js"

const props = defineProps<{
  step: ThoughtStep
  open: boolean
}>()
const emit = defineEmits<{ toggle: [open: boolean] }>()
const label = computed(() => thoughtStepLabel(props.step))
</script>

<style scoped>
.tool-row {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tool-row-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-code);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-row-trigger:is(:focus-visible, [aria-expanded="true"]) {
  color: var(--fg);
}

@media (hover: hover) {
  .tool-row-trigger:hover {
    color: var(--fg);
  }
}

.thought-caret {
  flex: none;
  margin-inline-start: auto;
  width: var(--icon-sm);
  height: var(--icon-sm);
  transition: transform var(--duration-fast) var(--ease-out);
}

.thought-caret.is-open {
  transform: rotate(90deg);
}

.thought-body {
  overflow: visible;
  transition: none;
  min-width: 0;
  padding-block-start: var(--space-xs);
  font-size: var(--text-meta);
  line-height: var(--text-code-line);
}

.thought-body :deep(.tool-output-card) {
  --card-background-color: var(--bg-surface);
}

@media (prefers-reduced-motion: reduce) {
  .thought-caret {
    transition: none;
  }
}
</style>
