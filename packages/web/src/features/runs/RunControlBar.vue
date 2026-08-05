<template>
  <div class="c-status">
    <RunStatusBadge :status="status" />
    <span v-if="queuedCount" class="c-note">队列 {{ queuedCount }}（FIFO）</span>
    <span class="spacer"></span>
    <button
      v-if="status === 'running'"
      type="button"
      class="secondary"
      :disabled="steerDisabled"
      @click="emit('steer')"
    >
      Steer
    </button>
    <button type="button" class="secondary" :disabled="cancelling" @click="emit('cancel-run')">
      {{ cancelLabel(cancelling) }}
    </button>
  </div>
</template>

<script lang="ts">
/** 取消按钮文案：取消中切换为进行中文案。 */
export function cancelLabel(cancelling: boolean): string {
  return cancelling ? "取消中…" : "取消 Run";
}
</script>

<script setup lang="ts">
import RunStatusBadge from "./RunStatusBadge.vue";
import type { RunStatus } from "./run-state.js";

withDefaults(
  defineProps<{
    /** 当前 Run 状态：徽标展示、Steer 显隐 */
    status: RunStatus;
    /** 队列等待数，>0 时显示队列提示 */
    queuedCount?: number;
    /** 当前 Run 是否已进入取消中：禁用取消按钮并切换文案 */
    cancelling?: boolean;
    /** 编辑器无输入时禁用 Steer */
    steerDisabled?: boolean;
  }>(),
  { queuedCount: 0, cancelling: false, steerDisabled: false },
);

const emit = defineEmits<{
  steer: [];
  "cancel-run": [];
}>();
</script>

<style scoped>
.c-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}
.c-note {
  font-size: var(--text-caption);
  color: var(--ink-muted);
}
.spacer {
  flex: 1;
}
.secondary {
  font: inherit;
  font-size: var(--text-caption);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: var(--border-width) solid var(--hairline);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.secondary:hover:not(:disabled) {
  background: var(--canvas-soft);
}
.secondary:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
