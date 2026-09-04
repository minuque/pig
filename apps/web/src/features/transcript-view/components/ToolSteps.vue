<template>
  <section class="tool-steps" :class="{ live, aborted: row.aborted }">
    <Button type="button" static class="summary-btn" @click="emit('toggle-expand', !revealed)">
      <Spinner v-if="live" class="tool-steps-icon" />
      <BadgeCheck v-else class="tool-steps-icon" />
      <span :class="{ shimmer: live }">{{ label }}</span>
      <ChevronRight class="motion-turn" :class="{ 'is-on': revealed }" data-icon="inline-end" />
    </Button>
    <div
      class="tool-calls-group"
      :class="{ 'is-open': expanded, instant: live || !expanded }"
      :inert="!expanded"
    >
      <div>
        <TransitionGroup v-if="rendered" appear name="timeline-step" tag="div" class="steps">
          <div v-for="step in row.steps" :key="step.id" class="step">
            <ToolCall
              :step="step"
              :is-expand="expandedTools"
              @toggle="emit('toggle-tool', $event.id, $event.open)"
            />
          </div>
        </TransitionGroup>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { ChevronRight, BadgeCheck } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import ToolCall from "./ToolCall.vue"
import { toolRowLabel } from "../lib/transcript-rows.js"
import type { ToolRow } from "../type.js"

const props = defineProps<{
  row: ToolRow
  isExpand: boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  "toggle-expand": [open: boolean]
  "toggle-tool": [id: string, open: boolean]
}>()
const live = computed(() => props.row.mode === "live")
const revealed = computed(() => props.row.turnStreaming || props.isExpand === true)
const rendered = shallowRef(revealed.value)
const expanded = shallowRef(revealed.value)

watch(
  revealed,
  (open) => {
    if (!open) {
      expanded.value = false
      return
    }
    const first = !rendered.value
    rendered.value = true
    if (!first) {
      expanded.value = true
      return
    }
    requestAnimationFrame(() => {
      if (revealed.value) expanded.value = true
    })
  },
  { flush: "sync" },
)

const now = shallowRef(Date.now())
const label = computed(() => toolRowLabel(props.row, now.value))
watch(
  () => live.value && props.row.timing?.endedAt === undefined && props.row.timing !== undefined,
  (active, _, cleanup) => {
    if (!active) return
    now.value = Date.now()
    const timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
    cleanup(() => clearInterval(timer))
  },
  { immediate: true },
)
</script>

<style scoped>
.tool-steps {
  min-width: 0;
}
.summary-btn {
  height: auto;
  min-height: 28px;
  padding: 2px 0;
  gap: var(--spacing-xs);
  justify-content: flex-start;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  white-space: normal;
  text-align: start;
  font-variant-numeric: tabular-nums;
}
.summary-btn:hover {
  background: transparent;
  color: var(--ink);
}
.aborted .summary-btn {
  color: var(--warning);
}
.tool-steps-icon {
  flex: none;
  transition: color var(--duration-fast) var(--ease-out);
}
.steps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-block: var(--spacing-xs);
}
.step {
  position: relative;
  min-width: 0;
  padding-inline-start: calc(var(--size-icon) + var(--spacing-xs));
}
.step::after {
  position: absolute;
  inset-block: calc(-1 * var(--spacing-xs));
  inset-inline-start: calc(var(--size-icon) / 2);
  width: var(--border-width);
  background: var(--hairline);
  pointer-events: none;
  content: "";
}
</style>
