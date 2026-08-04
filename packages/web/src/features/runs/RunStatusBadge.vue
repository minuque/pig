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

defineProps<{ status: string }>();

/* run 状态双编码（文字 + 颜色，对齐原型 RUN_META） */
const STATUS_COLORS: Record<string, string> = {
  admission: "var(--ink-faint)",
  queued: "var(--ink-faint)",
  running: "var(--primary)",
  cancelling: "var(--accent-orange)",
  completed: "var(--accent-green)",
  failed: "var(--accent-orange)",
  cancelled: "var(--ink-faint)",
};
const PULSING = new Set(["running", "cancelling"]);

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "var(--ink-faint)";
}
function isPulsing(status: string) {
  return PULSING.has(status);
}
</script>
