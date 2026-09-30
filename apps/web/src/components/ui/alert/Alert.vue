<template>
  <div
    ref="root"
    data-slot="alert"
    :data-variant="variant"
    :class="[
      'alert relative flex w-full flex-col gap-1 rounded-(--radius-lg) border px-(--spacing-xs) py-(--spacing-xs) text-body-sm',
      variantClasses[variant],
      props.class,
    ]"
  >
    <div class="alert-header flex items-center gap-2">
      <span class="alert-icon flex items-center justify-center">
        <slot name="icon" />
      </span>

      <div class="min-w-0 flex-1 font-medium">
        <slot name="title" />
      </div>

      <button
        v-if="dismissible"
        type="button"
        class="alert-action flex size-5 items-center justify-center rounded-(--radius-sm)"
        aria-label="关闭"
        @click="emit('close')"
      >
        <X class="size-3.5" />
      </button>

      <button
        v-else
        type="button"
        class="alert-action flex size-5 items-center justify-center rounded-(--radius-sm)"
        :class="{ 'is-copied': status === 'copied', 'is-error': status === 'error' }"
        :aria-label="copyLabel"
        @click="copy"
      >
        <span class="icon-swap">
          <Copy class="size-3.5" :data-visible="status !== 'copied'" />
          <Check class="size-3.5" :data-visible="status === 'copied'" />
        </span>
      </button>
    </div>

    <div class="min-w-0 text-body-sm [&_p]:leading-relaxed">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue"
import { useTimeoutFn } from "@vueuse/core"
import { Check, Copy, X } from "@lucide/vue"
import type { HTMLAttributes } from "vue"

type AlertVariant = "default" | "error" | "info" | "success" | "warning"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    variant?: AlertVariant
    dismissible?: boolean
  }>(),
  { class: undefined, variant: "default", dismissible: false },
)
const emit = defineEmits<{ close: [] }>()
const variantClasses: Record<AlertVariant, string> = {
  default: "border-border bg-muted/30 text-ink [&_.alert-icon]:text-ink-muted",
  error: "border-danger/30 bg-danger/5 text-ink [&_.alert-icon]:text-danger",
  info: "border-info/30 bg-info/5 text-ink [&_.alert-icon]:text-info",
  success: "border-success/30 bg-success/5 text-ink [&_.alert-icon]:text-success",
  warning: "border-warning/30 bg-warning/5 text-ink [&_.alert-icon]:text-warning",
}
const root = useTemplateRef("root")
const status = shallowRef<"idle" | "copied" | "error">("idle")
const copyLabel = computed(() =>
  status.value === "copied"
    ? "已复制"
    : status.value === "error"
      ? "复制失败，点击重试"
      : "复制内容",
)
const { start, stop } = useTimeoutFn(() => (status.value = "idle"), 1500, { immediate: false })

async function copy() {
  const text = (root.value?.innerText ?? "").trim()

  if (!text) return
  stop()

  try {
    await navigator.clipboard.writeText(text)
    status.value = "copied"
    start()
  } catch {
    status.value = "error"
  }
}
</script>

<style scoped>
.alert-action {
  color: var(--ink-muted);
}

.alert-action:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.alert-action.is-copied {
  color: var(--success);
}

.alert-action.is-error {
  color: var(--danger);
}

.alert-icon :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
}

.icon-swap {
  position: relative;
  display: inline-flex;
  width: 0.875rem;
  height: 0.875rem;
}

.icon-swap :deep(svg) {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.icon-swap :deep(svg[data-visible="true"]) {
  opacity: 1;
}
</style>
