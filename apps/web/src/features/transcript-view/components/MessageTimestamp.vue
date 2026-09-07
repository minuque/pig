<template>
  <div
    v-if="valid"
    class="stamp"
    :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
  >
    <time :datetime="iso" :title="full">{{ clock }}</time>
    <Button
      type="button"
      variant="outline"
      size="icon-2xs"
      class="copy"
      :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
      :title="copyLabel"
      @click="copy"
    >
      <span class="icon-swap">
        <Copy class="size-3" :data-visible="status !== 'copied'" />
        <Check class="size-3" :data-visible="status === 'copied'" />
      </span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { Check, Copy } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"

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
const copyLabel = computed(() =>
  status.value === "copied"
    ? "已复制"
    : status.value === "error"
      ? "复制失败，点击重试"
      : "复制时间",
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
  position: relative;
  display: inline-flex;
  align-items: center;
  width: fit-content;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.copy {
  position: absolute;
  inset-inline-start: 100%;
  inset-block-start: 50%;
  translate: var(--spacing-xxs) -50%;
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-secondary);
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}
.stamp:hover .copy,
.stamp:focus-within .copy,
.stamp.is-copied .copy,
.stamp.is-error .copy {
  opacity: 1;
  pointer-events: auto;
}
.copy:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}
.copy.is-copied {
  color: var(--success);
}
.copy.is-error {
  color: var(--danger);
}

.icon-swap {
  width: 12px;
  height: 12px;
}

@media (hover: none) {
  .copy {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
