<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="[
      buttonBase,
      !props.static && buttonPress,
      buttonVariant[variant],
      buttonSize[size],
      props.class,
    ]"
  >
    <slot />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import {
  buttonBase,
  buttonPress,
  buttonSize,
  buttonVariant,
  type ButtonSize,
  type ButtonVariant,
} from "./index.js"

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: ButtonSize
  class?: HTMLAttributes["class"]
  static?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  asChild: false,
  variant: "default",
  size: "default",
  class: undefined,
  static: false,
})
</script>
