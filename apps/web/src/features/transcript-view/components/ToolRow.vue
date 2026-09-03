<template>
  <section class="tool-row" :class="{ live, failed: row.aborted }">
    <Button type="button" static class="summary-btn" @click="emit('toggle-expand', !revealed)">
      <svg
        class="tool-row-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a9.75 9.75 0 0 1 6.74 2.74" />
        <path d="M18.74 5.74 21 8" />
        <path d="M21 8V3" />
        <path d="M7.5 19.794c-6-3.464-6-12.124 0-15.588" />
        <path d="M7.5 4.206A9 9 0 0 1 12 3" />
        <path d="M12 7v5l4 2" />
        <path d="M14 20.775A9 9 0 0 1 12 21" />
        <path d="M19 17.656a9 9 0 0 1-1.5 1.456" />
        <path d="M21 12a9 9 0 0 1-.228 2" />
        <path d="M21 8h-5" />
      </svg>
      <span :class="{ shimmer: live }">{{ label }}</span>
      <ChevronRight
        class="motion-turn"
        :class="{ 'is-on': revealed }"
        :stroke-width="1.5"
        data-icon="inline-end"
      />
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
import { ChevronRight } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import ToolCall from "./ToolCall.vue"
import { toolRowLabel, type ToolRow } from "../lib/transcript-rows.js"

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
.tool-row {
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
  color: var(--on-primary);
}
.failed .summary-btn {
  color: var(--danger);
}
.tool-row-icon {
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
