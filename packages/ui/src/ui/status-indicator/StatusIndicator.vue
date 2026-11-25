<template>
  <span
    data-slot="status-indicator"
    :class="props.class"
    :data-status="status"
    :data-tone="tone"
    :data-appearance="appearance"
    :data-size="size"
    :role="ariaLabel && !label ? 'status' : undefined"
    :aria-label="ariaLabel && !label ? ariaLabel : undefined"
  >
    <span
      v-if="appearance === 'dot'"
      data-slot="status-dot"
      :class="{ 'status-pulse': pulse }"
      aria-hidden="true"
    />

    <CircleCheckIcon v-else-if="status === 'success'" data-slot="status-glyph" aria-hidden="true" />

    <CircleExclamationPointIcon
      v-else-if="status === 'error' || status === 'warning'"
      data-slot="status-glyph"
      aria-hidden="true"
    />

    <PenIcon v-else-if="status === 'draft'" data-slot="status-glyph" aria-hidden="true" />
    <CircleDashedIcon v-else data-slot="status-glyph" aria-hidden="true" />
    <span v-if="label" data-slot="status-label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue"
import { CircleCheckIcon, CircleDashedIcon, CircleExclamationPointIcon, PenIcon } from "@lucide/vue"
import type { Size, Tone } from "../../core/types.js"

export type StatusTone = "idle" | "running" | "waiting" | "success" | "warning" | "error" | "draft"

export type StatusAppearance = "dot" | "icon"

const STATUS_TONE_MAP: Partial<Record<StatusTone, Tone>> = {
  running: "info",
  waiting: "warning",
  success: "success",
  warning: "warning",
  error: "danger",
  draft: "warning",
}
const props = withDefaults(
  defineProps<{
    status: StatusTone
    appearance?: StatusAppearance | undefined
    size?: Size | undefined
    pulse?: boolean | undefined
    label?: string | undefined
    ariaLabel?: string | undefined
    class?: HTMLAttributes["class"] | undefined
  }>(),
  {
    appearance: "dot",
    size: "m",
    pulse: false,
    label: undefined,
    ariaLabel: undefined,
    class: undefined,
  },
)
const tone = computed(() => STATUS_TONE_MAP[props.status])
</script>

<style>
:where([data-slot="status-indicator"]) {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
  color: var(--fg-muted);
}

:where([data-slot="status-dot"]) {
  display: block;
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  border-radius: var(--radius-pill);
  corner-shape: round;
  background: currentColor;
}

:where([data-slot="status-indicator"][data-size="s"] [data-slot="status-dot"]) {
  inline-size: calc(var(--space-2xs) * 1.5);
  block-size: calc(var(--space-2xs) * 1.5);
}

:where([data-slot="status-glyph"]) {
  display: block;
  flex: none;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

:where([data-slot="status-indicator"][data-size="s"] [data-slot="status-glyph"]) {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}

:where([data-slot="status-label"]) {
  color: var(--fg);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

:where([data-slot="status-indicator"][data-appearance="icon"] [data-slot="status-label"]) {
  color: currentColor;
}

:where([data-slot="status-indicator"][data-tone][data-appearance="dot"]) {
  color: var(--tone);
}

:where([data-slot="status-indicator"][data-tone][data-appearance="icon"]) {
  color: var(--tone-text);
}
</style>
