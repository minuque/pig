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
        :pinned="latest"
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
    </div>

    <TurnErrorRow v-if="turnError" class="turn-error-row" v-bind="turnError" />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue"
import { useIntersectionObserver } from "@vueuse/core"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TaskNotice from "@features/transcript-view/components/TaskNotice.vue"
import TurnErrorRow from "@features/transcript-view/components/TurnErrorRow.vue"
import ToolRun from "@features/transcript-view/components/tool/ToolRun.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { isToolRow } from "@features/transcript-view/lib/transcript-rows.js"
import type { TimelineTurn } from "@features/transcript-view/type.js"

const props = defineProps<{
  turn: TimelineTurn
  sessionId: string
  running: boolean
  isExpand: (id: string) => boolean | undefined
  expandedTools: Map<string, boolean>
  /** false 时先占位，滚到附近再挂载内容；挂过一次就一直保留。 */
  eager: boolean
  /** 最后一轮：它的助手正文底栏常驻显示。 */
  latest?: boolean
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

/** 一轮的错误只保留一条：从末尾找最近一次带错误状态的助手行。 */
const turnError = computed(() => {
  for (let index = props.turn.rows.length - 1; index >= 0; index -= 1) {
    const row = props.turn.rows[index]

    if (row?.role !== "assistant" || (!row.error && !row.aborted)) continue
    return {
      error: row.error,
      message: row.errorMessage,
      retryCount: row.retryCount,
    }
  }

  return null
})
</script>

<style scoped>
.turn {
  box-sizing: border-box;
  width: 100%;
}

.turn + .turn {
  margin-block-start: var(--transcript-turn-gap);
}

/* 还没挂载内容的回合按预估高度占位，滚动条长度接近真实 */
.turn.is-deferred {
  min-block-size: var(--size-turn-estimate);
}

/* 屏外的已完成回合跳过排版与绘制；最后一轮在流式中，始终正常渲染 */
.turn:not(:last-child) {
  content-visibility: auto;
  contain-intrinsic-size: auto var(--size-turn-estimate);
}

.row {
  box-sizing: border-box;
  width: 100%;
}

.row + .row {
  margin-block-start: var(--transcript-item-gap);
}

.turn-error-row {
  margin-block-start: var(--transcript-item-gap);
}

.row :deep(.stamp:not([data-pinned])) {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.row:hover :deep(.stamp),
.row:focus-within :deep(.stamp),
.row :deep(.stamp[data-status]) {
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
