<template>
  <Button
    type="button"
    variant="outline"
    size="sm"
    :disabled="aborting"
    :aria-label="aborting ? '正在停止当前 Turn' : '停止当前 Turn'"
    :title="
      queuedSteerCount ? `${queuedSteerCount} 条 Steering 排队中` : `停止${phaseLabel(phase)}`
    "
    @click="emit('abort')"
  >
    <Square data-icon="inline-start" />
    {{ aborting ? "正在停止" : "停止" }}
  </Button>
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
</script>

<script setup lang="ts">
import { Square } from "lucide-vue-next";
import { Button } from "@components/ui/button/index.js";

withDefaults(
  defineProps<{
    /** 当前 Session phase：用于停止按钮的辅助说明 */
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
