<template>
  <RadioGroupRoot
    data-slot="radio-group"
    v-bind="forwardedProps"
    :data-accent-color="color"
    class="rt-RadioGroupRoot"
    :class="[sizeClass, variantClass, highContrast && 'rt-high-contrast', props.class]"
  >
    <slot />
  </RadioGroupRoot>
</template>

<script setup lang="ts">
import type { RadioGroupRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, provide, reactive } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupRoot, useForwardProps } from "reka-ui"
import { RADIO_GROUP_KEY } from "./context.js"

const props = withDefaults(
  defineProps<
    RadioGroupRootProps & {
      class?: HTMLAttributes["class"]
      /** Radix Themes 的单选尺寸：1、2、3 */
      size?: "1" | "2" | "3"
      variant?: "classic" | "surface" | "soft"
      color?: string
      highContrast?: boolean
    }
  >(),
  { class: undefined, size: "2", variant: "surface", highContrast: false },
)
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "highContrast")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<RadioGroupRootProps>
const sizeClass = `rt-r-size-${props.size}`
const variantClass = `rt-variant-${props.variant}`

// 尺寸与变体挂在每个 Radio 上（rt 的 .rt-BaseRadioRoot:where(.rt-r-size-N) 就是这么选的）
provide(
  RADIO_GROUP_KEY,
  computed(() => reactive({ size: props.size, variant: props.variant })),
)
</script>
