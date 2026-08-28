<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import {
  buttonBase,
  buttonSize,
  buttonVariant,
  type ButtonSize,
  type ButtonVariant,
} from "./index.js"

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: ButtonSize
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  asChild: false,
  variant: "default",
  size: "default",
  class: undefined,
})
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="[
      buttonBase,
      buttonVariant[variant],
      buttonSize[size],
      'active:scale-[0.96]',
      props.class,
    ]"
  >
    <slot />
  </Primitive>
</template>
