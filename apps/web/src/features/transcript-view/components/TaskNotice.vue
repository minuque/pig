<template>
  <Callout class="task-notice" variant="soft" size="s" :color="color" :data-status="task.status">
    <template #icon><component :is="icon" /></template>
    <span class="task-notice-label">{{ label }}</span>
    <span class="task-notice-text">{{ task.description }}</span>
    <span v-if="elapsed" class="task-notice-time">{{ elapsed }}</span>
  </Callout>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Callout, type CalloutColor } from "@components/ui/callout/index.js"
import { CheckCircleIcon, DangerCircleIcon, StopIcon } from "@components/icons/index.js"
import { formatElapsed } from "@utils/time.js"
import type { Task } from "@/types/common-type.js"

const props = defineProps<{ task: Task }>()
const { t } = useI18n()
/** 任务结束的通知：「后台命令已完成 · 描述 · 耗时」，颜色与图标跟着结局走。 */
const label = computed(() => t(`taskNotice.${props.task.kind}.${props.task.status}`))
const color = computed<CalloutColor>(() =>
  props.task.status === "completed"
    ? "success"
    : props.task.status === "failed"
      ? "destructive"
      : "neutral",
)
const icon = computed(() =>
  props.task.status === "completed"
    ? CheckCircleIcon
    : props.task.status === "failed"
      ? DangerCircleIcon
      : StopIcon,
)
const elapsed = computed(() => {
  const { startedAt, completedAt } = props.task
  return startedAt !== undefined && completedAt !== undefined
    ? formatElapsed(completedAt - startedAt, { showMs: false })
    : ""
})
</script>

<style scoped>
.task-notice-text {
  min-inline-size: 0;
  overflow-wrap: anywhere;
}

.task-notice-text::before,
.task-notice-time::before {
  margin-inline: var(--space-xs);
  content: "·";
}

.task-notice-time {
  font-variant-numeric: tabular-nums;
}
</style>
