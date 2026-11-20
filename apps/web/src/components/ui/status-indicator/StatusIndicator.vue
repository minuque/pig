<template>
  <span
    data-slot="status-indicator"
    class="status-indicator"
    :class="props.class"
    :data-status="status"
    :data-appearance="appearance"
    :data-size="size"
    :role="ariaLabel && !label ? 'status' : undefined"
    :aria-label="ariaLabel && !label ? ariaLabel : undefined"
  >
    <span
      v-if="appearance === 'dot'"
      class="status-dot"
      :class="{ 'status-pulse': pulse }"
      aria-hidden="true"
    />

    <svg
      v-else-if="status === 'running'"
      class="status-spinner motion-spin"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle class="status-track" cx="12" cy="12" r="10" pathLength="100" />
      <circle class="status-arc" cx="12" cy="12" r="10" pathLength="100" />
    </svg>

    <CircleCheckIcon v-else-if="status === 'success'" class="status-glyph" aria-hidden="true" />

    <CircleExclamationPointIcon
      v-else-if="status === 'error' || status === 'warning'"
      class="status-glyph"
      aria-hidden="true"
    />

    <PenIcon v-else-if="status === 'draft'" class="status-glyph" aria-hidden="true" />
    <CircleDashedIcon v-else class="status-glyph" aria-hidden="true" />
    <span v-if="label" class="status-label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleExclamationPointIcon,
  PenIcon,
} from "@components/icons/index.js"
import type { Size } from "@components/ui/size.js"

export type StatusTone = "idle" | "running" | "waiting" | "success" | "warning" | "error" | "draft"

export type StatusAppearance = "dot" | "icon"

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
</script>

<style scoped>
.status-indicator {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
  color: var(--fg-muted);
}

.status-dot {
  display: block;
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  border-radius: var(--radius-pill);
  background: currentColor;
}

.status-indicator[data-size="s"] .status-dot {
  inline-size: calc(var(--space-2xs) * 1.5);
  block-size: calc(var(--space-2xs) * 1.5);
}

.status-indicator[data-size="l"] .status-dot {
  inline-size: calc(var(--space-2xs) * 2.5);
  block-size: calc(var(--space-2xs) * 2.5);
}

.status-spinner,
.status-glyph {
  display: block;
  flex: none;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

.status-indicator[data-size="s"] :is(.status-spinner, .status-glyph) {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}

.status-indicator[data-size="l"] :is(.status-spinner, .status-glyph) {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}

.status-track,
.status-arc {
  fill: none;
  stroke-width: 3;
}

.status-track {
  stroke: var(--bg-emphasis);
}

.status-arc {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 26 74;
}

.status-label {
  color: var(--fg);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.status-indicator[data-appearance="icon"] .status-label {
  color: currentColor;
}

.status-indicator[data-appearance="dot"][data-status="running"] {
  color: var(--info-solid);
}

.status-indicator[data-appearance="icon"][data-status="running"] {
  color: var(--info-text);
}

.status-indicator[data-appearance="dot"][data-status="success"] {
  color: var(--success-solid);
}

.status-indicator[data-appearance="icon"][data-status="success"] {
  color: var(--success-text);
}

.status-indicator[data-appearance="dot"]:is(
    [data-status="waiting"],
    [data-status="warning"],
    [data-status="draft"]
  ) {
  color: var(--warning-solid);
}

.status-indicator[data-appearance="icon"]:is(
    [data-status="waiting"],
    [data-status="warning"],
    [data-status="draft"]
  ) {
  color: var(--warning-text);
}

.status-indicator[data-appearance="dot"][data-status="error"] {
  color: var(--danger-solid);
}

.status-indicator[data-appearance="icon"][data-status="error"] {
  color: var(--danger-text);
}
</style>
