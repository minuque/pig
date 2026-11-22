<template>
  <Polymorphic
    v-bind="$attrs"
    data-button
    data-slot="icon-button"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    :data-disabled="disabled || loading ? '' : undefined"
    :data-loading="loading || undefined"
    :disabled="disabled || loading"
    :as="as"
    :as-child="asChild"
    :class="props.class"
  >
    <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
  </Polymorphic>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Polymorphic, type PolymorphicProps } from "@components/ui/primitive/index.js"
import type { Size, ToneColor } from "@/types/ui-type.js"
import type { ButtonVariant, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

defineOptions({ inheritAttrs: false })

interface Props extends PolymorphicProps {
  variant?: ButtonVariant
  size?: Size
  color?: ToneColor
  radius?: Radius
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
:where([data-slot="icon-button"][data-size="s"]) {
  height: var(--space-lg);
  inline-size: var(--space-lg);
}

:where([data-slot="icon-button"][data-size="m"]) {
  height: var(--control-sm);
  inline-size: var(--control-sm);
}

:where([data-slot="icon-button"][data-size="l"]) {
  height: var(--control-lg);
  inline-size: var(--control-lg);
}
</style>
