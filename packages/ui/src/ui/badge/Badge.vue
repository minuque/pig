<template>
  <span
    v-bind="$attrs"
    data-slot="badge"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    :class="props.class"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { Size, ToneColor, Radius } from "../../core/types.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    size?: Size
    variant?: "solid" | "soft" | "surface" | "outline"
    color?: ToneColor
    radius?: Radius
    class?: HTMLAttributes["class"]
  }>(),
  {
    size: "s",
    variant: "soft",
    class: undefined,
  },
)
</script>

<style>
:where([data-slot="badge"]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: fit-content;
  border: 0;
  font-family: var(--font-sans);
  font-style: normal;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

:where([data-slot="badge"][data-size="s"]) {
  padding: calc(var(--space-2xs) * 0.5) calc(var(--space-2xs) * 1.5);
  border-radius: calc(var(--radius-control) / 2);
  gap: calc(var(--space-2xs) * 1.5);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="badge"][data-size="m"]) {
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  gap: calc(var(--space-2xs) * 1.5);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="badge"][data-variant="solid"]) {
  background-color: var(--tone);
  color: var(--fg-on-accent);
}

:where([data-slot="badge"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
  color: var(--tone-text);
}

:where([data-slot="badge"][data-variant="surface"]) {
  background-color: var(--tone-subtle);
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
  color: var(--tone-text);
}

:where([data-slot="badge"][data-variant="outline"]) {
  background-color: transparent;
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
  color: var(--tone-text);
}
</style>
