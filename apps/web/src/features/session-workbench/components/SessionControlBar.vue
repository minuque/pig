<template>
  <div class="hint" role="status">
    <span class="dot" aria-hidden="true" :style="{ backgroundColor: phaseColor(phase) }"></span>
    <span class="phase">{{ phaseLabel(phase) }}</span>
    <span v-if="queuedSteerCount" class="meta">Steer 队列 {{ queuedSteerCount }}</span>
    <span v-else class="meta">发送将作为 Steer 追加</span>
    <button type="button" class="stop" :disabled="aborting" @click="emit('abort')">
      {{ aborting ? "取消中…" : "停止" }}
    </button>
  </div>
</template>

<script lang="ts">
import type { SessionPhase } from "@earendil-works/pi-protocol";

/** phase 文案：对齐官方 SessionPhase。 */
export function phaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case "turn":
      return "运行中";
    case "compaction":
      return "压缩中";
    case "retry":
      return "重试中";
    case "branch_summary":
      return "分支摘要";
    default:
      return "空闲";
  }
}

/** phase 状态双编码（文字 + 颜色）。 */
export function phaseColor(phase: SessionPhase): string {
  switch (phase) {
    case "turn":
      return "var(--primary)";
    case "compaction":
    case "retry":
      return "var(--accent-orange)";
    default:
      return "var(--ink-faint)";
  }
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 当前 Session phase：点 + 文案 */
    phase: SessionPhase;
    /** 排队中的 Steer 数，>0 时显示提示 */
    queuedSteerCount?: number;
    /** 取消中：禁用按钮并切换文案 */
    aborting?: boolean;
  }>(),
  { queuedSteerCount: 0, aborting: false },
);

const emit = defineEmits<{
  abort: [];
}>();
</script>

<style scoped>
.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: var(--text-caption);
  color: var(--ink-muted);
}
.dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: var(--radius-full);
}
.phase {
  flex: none;
  font-weight: var(--font-weight-medium);
}
.meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-faint);
}
.stop {
  margin-left: auto;
  flex: none;
  font: inherit;
  font-size: var(--text-caption);
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}
.stop:hover:not(:disabled) {
  color: var(--ink);
}
.stop:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
