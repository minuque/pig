<template>
  <button
    v-if="valid"
    type="button"
    class="stamp press-scale"
    :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
    :title="title"
    :aria-label="title"
    @click="copy"
  >
    <time :datetime="iso">{{ label }}</time>
  </button>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"

const props = defineProps<{
  timestamp: number
}>()

const valid = computed(() => Number.isFinite(props.timestamp) && props.timestamp > 0)
const date = computed(() => new Date(props.timestamp))
const iso = computed(() => (valid.value ? date.value.toISOString() : ""))
const clock = computed(() => {
  if (!valid.value) return ""
  const now = new Date()
  const sameDay = date.value.toDateString() === now.toDateString()
  return new Intl.DateTimeFormat(
    "zh-CN",
    sameDay
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false },
  ).format(date.value)
})
const full = computed(() =>
  valid.value
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(date.value)
    : "",
)

const status = shallowRef<"idle" | "copied" | "error">("idle")
const label = computed(() =>
  status.value === "copied" ? "已复制" : status.value === "error" ? "复制失败" : clock.value,
)
const title = computed(() =>
  status.value === "copied"
    ? "已复制"
    : status.value === "error"
      ? "复制失败，点击重试"
      : `${full.value} · 点击复制`,
)
const { start, stop } = useTimeoutFn(() => (status.value = "idle"), 1500, { immediate: false })

async function copy() {
  if (!iso.value) return
  stop()
  try {
    await navigator.clipboard.writeText(iso.value)
    status.value = "copied"
    start()
  } catch {
    status.value = "error"
  }
}
</script>

<style scoped>
.stamp {
  width: fit-content;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  cursor: pointer;
  transition:
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}
.stamp:hover {
  color: var(--ink-muted);
}
.stamp.is-copied {
  color: var(--success);
}
.stamp.is-error {
  color: var(--danger);
}
</style>
