<template>
  <section class="tool-row" :class="{ live, failed: row.aborted }">
    <Button
      type="button"
      static
      class="fold"
      :aria-expanded="revealed"
      :aria-controls="bodyId"
      @click="emit('toggle-fold', !revealed)"
    >
      <span>{{ label }}</span>
      <ChevronRight
        class="motion-turn"
        :class="{ 'is-on': revealed }"
        :stroke-width="1.5"
        data-icon="inline-end"
        aria-hidden="true"
      />
    </Button>
    <div
      :id="bodyId"
      class="fold-height"
      :class="{ 'is-open': revealed }"
      :inert="!revealed"
      :aria-hidden="!revealed"
    >
      <div>
        <div v-if="rendered" class="steps">
          <template v-for="step in row.steps" :key="step.id">
            <AssistantMessage
              v-if="step.type === 'assistant'"
              :item="step.item"
              :streaming="live && step.item.streaming"
            />
            <ThinkCard
              v-else-if="step.type === 'thought'"
              :text="step.text"
              :streaming="step.streaming"
              :open="expandedTools.get(step.id) === true"
              @update:open="emit('toggle-tool', step.id, $event)"
            />
            <ToolCall
              v-else
              :group="step"
              :expanded="expandedTools"
              @toggle="emit('toggle-tool', $event.id, $event.open)"
            />
          </template>
          <div v-if="row.waiting" class="waiting">
            <ThinkingOrb />
            <ThinkingState text="思考中" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, shallowRef, useId, watch } from "vue"
import { ChevronRight } from "lucide-vue-next"
import { Button } from "@components/ui/button/index.js"
import AssistantMessage from "./AssistantMessage.vue"
import ThinkCard from "./ThinkCard.vue"
import ThinkingOrb from "./ThinkingOrb.vue"
import ThinkingState from "./ThinkingState.vue"
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
const bodyId = useId()
const live = computed(() => props.row.mode === "live")
const revealed = computed(() => props.foldOpen ?? live.value)
const rendered = shallowRef(revealed.value)
watch(
  revealed,
  (open) => {
    if (open) rendered.value = true
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
  color: var(--ink-secondary);
}
.failed .fold {
  color: var(--danger);
}
.steps {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-block: var(--spacing-xs);
  border-block-start: var(--border-width) solid var(--hairline);
}
.waiting {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
}
</style>
