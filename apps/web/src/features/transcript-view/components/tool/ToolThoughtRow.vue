<template>
  <div class="tool-row">
    <button
      type="button"
      class="tool-row-trigger"
      :aria-expanded="open"
      @click="emit('toggle', !open)"
    >
      <span
        class="thought-label"
        :class="{ shimmer: step.streaming }"
        :data-text="step.streaming ? label : undefined"
      >
        {{ label }}
      </span>

      <AltArrowRightIcon class="thought-caret" :class="{ 'is-open': open }" data-icon="inline" />
    </button>

    <div v-if="open" class="thought-body">
      <ToolOutput :text="step.text" soft-wrap />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { AltArrowRightIcon } from "@components/icons/index.js"
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
  gap: var(--space-xxs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-muted);
  font: inherit;
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.tool-row-trigger:hover,
.tool-row-trigger:focus-visible,
.tool-row-trigger[aria-expanded="true"] {
  color: var(--contrast-foreground-secondary);
}

.thought-caret {
  flex: none;
  width: var(--size-icon-xs);
  height: var(--size-icon-xs);
  transition: transform var(--duration-fast) var(--ease-out);
}

.thought-caret.is-open {
  transform: rotate(90deg);
}

.thought-body {
  min-width: 0;
  padding-block-start: var(--space-xs);
  font-size: var(--text-meta);
  line-height: var(--text-code-line);
}

@media (prefers-reduced-motion: reduce) {
  .thought-caret {
    transition: none;
  }
}
</style>
