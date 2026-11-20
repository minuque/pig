<template>
  <Primitive
    data-slot="banner"
    :data-color="color"
    :data-size="size"
    :data-variant="variant"
    :data-tone="tone"
    :data-dismissible="dismissible || undefined"
    :data-has-icon="Boolean($slots.icon) || undefined"
    :as="as"
    :as-child="asChild"
    :class="[floating && 'surface-float', props.class]"
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

    <button
      v-if="dismissible"
      type="button"
      data-slot="banner-action"
      :aria-label="t('common.close')"
      @click="emit('close')"
    >
      <XIcon class="size-icon" />
    </button>
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { XIcon } from "@components/icons/index.js"
import type { Size, Tone } from "@/types/ui-type.js"
import { type BannerColor, type BannerVariant } from "./index.js"

const { t } = useI18n()

interface Props extends PrimitiveProps {
  variant?: BannerVariant
  color?: BannerColor
  size?: Size
  dismissible?: boolean
  floating?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "div",
  asChild: false,
  variant: "soft",
  color: "neutral",
  size: "m",
  dismissible: false,
  floating: false,
  class: undefined,
})
const emit = defineEmits<{ close: [] }>()
const TONE_BY_COLOR: Record<BannerColor, Tone> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  destructive: "danger",
}
const tone = computed(() => TONE_BY_COLOR[props.color])
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

:where([data-slot="banner"][data-size="l"]) {
  row-gap: var(--space-sm);
  column-gap: var(--space-md);
  padding: var(--space-lg);
  border-radius: var(--radius-dialog);
}

:where([data-slot="banner"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
}

:where([data-slot="banner"][data-variant="surface"]) {
  border: var(--border-width) solid var(--tone-border);
  background-color: var(--tone-subtle);
}

:where([data-slot="banner"][data-variant="outline"]) {
  border: var(--border-width) solid var(--tone-border);
}

:where([data-slot="banner-icon"]) {
  display: flex;
  align-items: center;
}

:where([data-slot="banner"][data-size="s"] [data-slot="banner-icon"]),
:where([data-slot="banner"][data-size="m"] [data-slot="banner-icon"]) {
  block-size: calc(var(--text-body) * var(--text-body--line-height));
}

:where([data-slot="banner"][data-size="l"] [data-slot="banner-icon"]) {
  block-size: calc(var(--text-title) * var(--text-title--line-height));
}

:where([data-slot="banner"][data-size="s"] [data-slot="banner-icon"] svg),
:where([data-slot="banner"][data-size="m"] [data-slot="banner-icon"] svg) {
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

:where([data-slot="banner"][data-size="l"] [data-slot="banner-icon"] svg) {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
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
}

:where([data-slot="banner"]:is([data-size="s"], [data-size="m"]) [data-slot="banner-title"]),
:where([data-slot="banner"]:is([data-size="s"], [data-size="m"]) [data-slot="banner-body"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="banner"][data-size="l"] [data-slot="banner-title"]),
:where([data-slot="banner"][data-size="l"] [data-slot="banner-body"]) {
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

:where([data-slot="banner-action"]) {
  position: absolute;
  inset-block-start: var(--space-xs);
  inset-inline-end: var(--space-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 20px;
  block-size: 20px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: currentColor;
  cursor: pointer;
}

:where([data-slot="banner-action"]:hover) {
  background: var(--bg-hover);
}

:where([data-slot="banner-action"]:focus-visible) {
  outline: 2px solid var(--focus-color);
}
</style>
