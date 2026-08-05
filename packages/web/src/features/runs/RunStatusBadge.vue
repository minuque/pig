<template>
  <Badge variant="outline" class="run-badge">
    <span
      class="dot"
      :class="{ pulse: isPulsing(status) }"
      aria-hidden="true"
      :style="{ backgroundColor: statusColor(status) }"
    ></span>
    {{ status }}
  </Badge>
</template>

<script setup lang="ts">
import Badge from "@/components/ui/badge.vue";
import type { RunStatus } from "./run-state.js";

defineProps<{ status: RunStatus }>();

/* run 状态双编码（文字 + 颜色，对齐原型 RUN_META） */
const STATUS_COLORS: Record<RunStatus, string> = {
  queued: "var(--ink-faint)",
  running: "var(--primary)",
  cancelling: "var(--accent-orange)",
  completed: "var(--accent-green)",
  failed: "var(--accent-orange)",
  cancelled: "var(--ink-faint)",
};
const PULSING = new Set<RunStatus>(["running", "cancelling"]);

function statusColor(status: RunStatus) {
  return STATUS_COLORS[status];
}
function isPulsing(status: RunStatus) {
  return PULSING.has(status);
}
</script>

<style scoped>
.run-badge {
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}
.dot.pulse {
  animation: dot-pulse 1.6s var(--ease-in-out) infinite;
}
@keyframes dot-pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot.pulse {
    animation: none;
  }
}
</style>
