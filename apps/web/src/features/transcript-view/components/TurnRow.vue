<template>
  <div
    v-if="!shown"
    ref="placeholder"
    class="turn is-deferred"
    :data-turn-id="turn.id"
    :data-row-id="turn.rows[0]?.id"
    :data-minimap-row="turn.rows[0]?.role === 'user' ? turn.rows[0].id : undefined"
  />

  <div v-else class="turn" :data-turn-id="turn.id">
    <div
      v-for="row in turn.rows"
      :key="row.id"
      class="row"
      :class="`row-${row.role}`"
      :data-row-id="row.id"
      :data-minimap-row="row.role === 'user' ? row.id : undefined"
    >
      <UserMessage v-if="row.role === 'user'" :item="row" />

      <AssistantMessage
        v-else-if="row.role === 'assistant'"
        :item="row"
        :session-id="sessionId"
        :streaming="running && row.streaming"
        :highlight-mode="highlightedEntry?.entryId === row.entryId ? highlightedEntry.mode : null"
      />

      <ToolRun
        v-else-if="isToolRow(row)"
        :row="row"
        :expanded="isExpand(row.id)"
        :expanded-tools="expandedTools"
        @toggle-expand="emit('toggleExpand', row.id, $event)"
        @toggle-tool="(id, open) => emit('toggleTool', row.id, id, open)"
      />

      <TaskNotice v-else-if="row.role === 'task'" :task="row.task" />

      <TimelineEvent
        v-else-if="row.role === 'event'"
        :row="row"
        :open="isExpand(row.id) ?? false"
        @toggle="emit('toggleExpand', row.id, $event)"
      />

      <TimelineAlert
        v-else-if="row.role === 'alert'"
        :row="row"
        :open="isExpand(row.id) ?? false"
        @toggle="emit('toggleExpand', row.id, $event)"
      />

      <ExtensionMessage
        v-else-if="row.role === 'extension'"
        :row="row"
        :open="isExpand(row.id) ?? false"
        @toggle="emit('toggleExpand', row.id, $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from "vue"
import { useIntersectionObserver } from "@vueuse/core"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TaskNotice from "@features/transcript-view/components/TaskNotice.vue"
import ExtensionMessage from "@features/transcript-view/components/events/ExtensionMessage.vue"
import TimelineAlert from "@features/transcript-view/components/events/TimelineAlert.vue"
import TimelineEvent from "@features/transcript-view/components/events/TimelineEvent.vue"
import ToolRun from "@features/transcript-view/components/tool/ToolRun.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { isToolRow } from "@features/transcript-view/lib/transcript-rows.js"
import type { HighlightedEntry } from "@features/transcript-view/hooks/use-transcript-jump.js"
import type { TimelineTurn } from "@features/transcript-view/type.js"

const props = defineProps<{
  turn: TimelineTurn
  sessionId: string
  running: boolean
  isExpand: (id: string) => boolean | undefined
  expandedTools: Map<string, boolean>
  eager: boolean
  highlightedEntry?: HighlightedEntry | null
}>()
const emit = defineEmits<{
  toggleExpand: [id: string, open: boolean]
  toggleTool: [rowId: string, id: string, open: boolean]
  shown: [id: string]
}>()
const shown = ref(props.eager)
const placeholder = useTemplateRef("placeholder")
const { stop } = useIntersectionObserver(
  placeholder,
  ([entry]) => {
    if (!entry?.isIntersecting) return
    shown.value = true
    emit("shown", props.turn.id)
    stop()
  },
  { rootMargin: "200% 0px" },
)

if (shown.value) stop()

watch(
  () => props.eager,
  (eager) => {
    if (!eager || shown.value) return
    shown.value = true
    stop()
  },
)
</script>

<style scoped>
.turn {
  box-sizing: border-box;
  width: 100%;
}

.turn + .turn {
  margin-block-start: var(--space-lg);
}

.turn.is-deferred {
  min-block-size: 480px;
}

.turn:not(:last-child) {
  content-visibility: auto;
  contain-intrinsic-size: auto 480px;
}

.row {
  box-sizing: border-box;
  width: 100%;
}

.row + .row {
  margin-block-start: 20px;
}

.row :deep(.stamp:not([data-pinned])) {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.row:hover :deep(.stamp),
.row:focus-within :deep(.stamp) {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .row :deep(.stamp) {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
