<template>
  <div
    data-slot="alert"
    :data-variant="variant"
    :class="[
      'alert relative grid w-full items-start gap-x-(--spacing-sm) gap-y-0.5 rounded-(--radius-lg) border px-3.5 py-(--spacing-sm) text-body-sm',
      variantClasses[variant],
      props.class,
    ]"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

type AlertVariant = "default" | "error" | "info" | "success" | "warning"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    variant?: AlertVariant
  }>(),
  { class: undefined, variant: "default" },
)

const variantClasses: Record<AlertVariant, string> = {
  default: "border-hairline bg-surface text-ink [&>svg]:text-ink-muted",
  error: "border-destructive/30 bg-destructive/5 text-ink [&>svg]:text-destructive",
  info: "border-info/30 bg-info/5 text-ink [&>svg]:text-info",
  success: "border-success/30 bg-success/5 text-ink [&>svg]:text-success",
  warning: "border-warning/30 bg-warning/5 text-ink [&>svg]:text-warning",
}
</script>

<style scoped>
.alert {
  grid-template-columns: minmax(0, 1fr) auto;
}
.alert:has(> svg) {
  grid-template-columns: 1rem minmax(0, 1fr) auto;
}
.alert > :deep(svg) {
  grid-column: 1;
  grid-row: 1 / span 2;
  width: 1rem;
  height: 1rem;
  margin-top: 2px;
}
.alert > :deep([data-slot="alert-title"]),
.alert > :deep([data-slot="alert-description"]) {
  grid-column: 1;
}
.alert:has(> svg) > :deep([data-slot="alert-title"]),
.alert:has(> svg) > :deep([data-slot="alert-description"]) {
  grid-column: 2;
}
.alert > :deep([data-slot="alert-action"]) {
  grid-column: 2;
  grid-row: 1 / span 2;
}
.alert:has(> svg) > :deep([data-slot="alert-action"]) {
  grid-column: 3;
}
</style>
