<template>
  <Primitive
    data-button
    data-slot="icon-button"
    :data-size="size"
    :data-variant="variant"
    :data-accent-color="color"
    :data-radius="radius"
    :data-high-contrast="highContrast || undefined"
    :data-disabled="disabled || loading ? '' : undefined"
    :data-loading="loading || undefined"
    :disabled="disabled || loading"
    :as="as"
    :as-child="asChild"
    :class="props.class"
    v-bind="$attrs"
  >
    <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"
import type { ButtonVariant, HighContrast, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

defineOptions({ inheritAttrs: false })

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: Size
  color?: string
  radius?: Radius
  highContrast?: HighContrast
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  asChild: false,
  variant: "solid",
  size: "m",
  loading: false,
  disabled: false,
  class: undefined,
})
</script>

<style>
:where([data-slot="icon-button"]) {
  padding: 0;
  border-radius: var(--radius-control);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

:where([data-slot="icon-button"])[data-size="s"] {
  height: var(--space-lg);
  inline-size: var(--space-lg);
}

:where([data-slot="icon-button"])[data-size="m"] {
  height: var(--control-sm);
  inline-size: var(--control-sm);
}

:where([data-slot="icon-button"])[data-size="l"] {
  height: var(--control-lg);
  inline-size: var(--control-lg);
}

:where([data-slot="icon-button"][data-variant="ghost"]) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  color: var(--fg);
}

:where([data-slot="icon-button"][data-variant="ghost"]:hover) {
  background-color: var(--bg-hover);
  color: var(--fg);
}
</style>
