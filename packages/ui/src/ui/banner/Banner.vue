<template>
  <div
    data-slot="banner"
    :role="ariaRole"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-dismissible="dismissible || undefined"
    :data-has-icon="Boolean($slots.icon) || undefined"
    :class="props.class"
  >
    <div v-if="$slots.icon" data-slot="banner-icon">
      <slot name="icon" />
    </div>

    <div data-slot="banner-content">
      <div v-if="$slots.title" data-slot="banner-title">
        <slot name="title" />
      </div>

      <div data-slot="banner-body">
        <slot />
      </div>
    </div>

    <IconButton
      v-if="dismissible"
      type="button"
      size="s"
      variant="ghost"
      color="neutral"
      data-slot="banner-action"
      :aria-label="labels.close"
      @click="emit('close')"
    >
      <XIcon class="size-icon" />
    </IconButton>
  </div>
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue"
import { XIcon } from "@lucide/vue"
import { useUiLabels } from "../../core/config.js"
import type { Size } from "../../core/types.js"
import { IconButton } from "../button/index.js"
import { type BannerColor, type BannerVariant } from "./index.js"

const labels = useUiLabels()

interface Props {
  variant?: BannerVariant
  color?: BannerColor
  size?: Size
  dismissible?: boolean
  role?: "alert" | "status" | "none" | undefined
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  variant: "soft",
  color: "neutral",
  size: "m",
  dismissible: false,
  role: undefined,
  class: undefined,
})
const emit = defineEmits<{ close: [] }>()
const ariaRole = computed(() => {
  if (props.role === "none") return undefined

  if (props.role) return props.role

  if (props.color === "danger" || props.color === "warning") return "alert"
  return undefined
})
</script>

<style>
:where([data-slot="banner"]) {
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  justify-content: start;
  text-align: left;
  color: var(--tone-text);
}

:where([data-slot="banner"][data-has-icon]) {
  grid-template-columns: auto minmax(0, 1fr);
}

:where([data-slot="banner"][data-size="s"]) {
  row-gap: var(--space-xs);
  column-gap: var(--space-xs);
  padding: var(--space-sm);
  border-radius: var(--radius-control);
}

:where([data-slot="banner"][data-size="m"]) {
  row-gap: var(--space-xs);
  column-gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-card);
}

:where([data-slot="banner"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
}

:where([data-slot="banner"][data-variant="surface"]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
  background-color: var(--tone-subtle);
}

:where([data-slot="banner"][data-variant="outline"]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
}

:where([data-slot="banner-icon"]) {
  display: flex;
  align-items: center;
}

:where([data-slot="banner"][data-size="s"] [data-slot="banner-icon"]),
:where([data-slot="banner"][data-size="m"] [data-slot="banner-icon"]) {
  block-size: calc(var(--text-body) * var(--text-body--line-height));
}

:where([data-slot="banner"][data-size="s"] [data-slot="banner-icon"] svg),
:where([data-slot="banner"][data-size="m"] [data-slot="banner-icon"] svg) {
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

:where([data-slot="banner-content"]) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-inline-size: 0;
}

:where([data-slot="banner"][data-dismissible] [data-slot="banner-content"]) {
  padding-inline-end: var(--space-lg);
}

:where([data-slot="banner-title"]) {
  font-weight: var(--font-weight-medium);
  text-wrap: balance;
}

:where([data-slot="banner-body"]) {
  text-wrap: pretty;
}

:where([data-slot="banner"]:is([data-size="s"], [data-size="m"]) [data-slot="banner-title"]),
:where([data-slot="banner"]:is([data-size="s"], [data-size="m"]) [data-slot="banner-body"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="banner-action"]) {
  position: absolute;
  inset-block-start: var(--space-xs);
  inset-inline-end: var(--space-xs);
}
</style>
