<template>
  <div class="c-status">
    <Badge variant="outline" class="phase-badge">
      <span class="dot" aria-hidden="true" :style="{ backgroundColor: phaseColor(phase) }"></span>
      {{ phaseLabel(phase) }}
    </Badge>
    <span v-if="queuedSteerCount" class="c-note">Steer 队列 {{ queuedSteerCount }}</span>
    <span class="spacer"></span>
    <button type="button" class="secondary" :disabled="aborting" @click="emit('abort')">
      {{ aborting ? "取消中…" : "停止" }}
    </button>
  </div>
</template>

<script lang="ts">
import type { SessionPhase } from "@earendil-works/pi-protocol";

/** phase 徽标文案：对齐官方 SessionPhase。 */
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
import Badge from "@/components/ui/badge.vue";

withDefaults(
  defineProps<{
    /** 当前 Session phase：徽标展示与显隐依据 */
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
.phase-badge {
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
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
