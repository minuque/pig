<template>
  <section class="tool-row" :class="{ live, failed: row.aborted }">
    <Button type="button" static class="fold" @click="emit('toggle-fold', !revealed)">
      <GitBranch class="tool-row-icon" :class="{ 'is-live': live }" :stroke-width="1.5" />
      <span>{{ label }}</span>
      <ChevronRight
        class="motion-turn"
        :class="{ 'is-on': revealed }"
        :stroke-width="1.5"
        data-icon="inline-end"
      />
    </Button>
    <div
      class="fold-height"
      :class="{ 'is-open': expanded, instant: live || !expanded }"
      :inert="!expanded"
    >
      <div>
        <TransitionGroup v-if="rendered" name="timeline-step" tag="div" class="steps">
          <div
            v-for="step in row.steps"
            :key="step.id"
            class="step"
            :class="{ 'is-assistant': step.type === 'assistant' }"
          >
            <AssistantMessage
              v-if="step.type === 'assistant'"
              :item="step.item"
              :streaming="live && step.item.streaming"
            />
            <ToolCall
              v-else
              :step="step"
              :expanded="expandedTools"
              @toggle="emit('toggle-tool', $event.id, $event.open)"
            />
          </div>
          <div v-if="row.waiting" key="waiting" class="step is-waiting">
            <StreamPlaceholder />
          </div>
        </TransitionGroup>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { ChevronRight, GitBranch } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import AssistantMessage from "./AssistantMessage.vue"
import StreamPlaceholder from "./StreamPlaceholder.vue"
import ToolCall from "./ToolCall.vue"
import { toolRowLabel, type ToolRow } from "../lib/transcript-rows.js"

const props = defineProps<{
  row: ToolRow
  foldOpen: boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  "toggle-fold": [open: boolean]
  "toggle-tool": [id: string, open: boolean]
}>()
const live = computed(() => props.row.mode === "live")
const revealed = computed(() => props.foldOpen ?? live.value)
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
.fold {
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
.fold:hover {
  background: transparent;
  color: var(--on-primary);
}
.failed .fold {
  color: var(--danger);
}
.tool-row-icon {
  flex: none;
  transition: color var(--duration-fast) var(--ease-out);
}
.tool-row-icon.is-live {
  color: var(--primary);
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
}
.step:not(.is-assistant) {
  padding-inline-start: calc(var(--size-icon) + var(--spacing-xs));
}
.step:not(.is-assistant)::after {
  position: absolute;
  inset-block: calc(-1 * var(--spacing-xs));
  inset-inline-start: calc(var(--size-icon) / 2);
  width: var(--border-width);
  background: var(--hairline);
  pointer-events: none;
  content: "";
}
</style>
