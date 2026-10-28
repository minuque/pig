<template>
  <RadioGroupRoot
    data-slot="radio-group"
    v-bind="forwardedProps"
    class="rt-RadioGroupRoot"
    :class="props.class"
  >
    <slot />
  </RadioGroupRoot>
</template>

<script setup lang="ts">
import type { RadioGroupRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, provide } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupRoot, useForwardProps } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"
import { RADIO_GROUP_KEY } from "./type.js"

const props = withDefaults(
  defineProps<
    RadioGroupRootProps & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "classic" | "surface" | "soft"
      color?: string
      highContrast?: boolean
    }
  >(),
  { class: undefined, size: "m", variant: "surface", highContrast: false },
)
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "highContrast")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<RadioGroupRootProps>

// 尺寸、变体、color 与 highContrast 挂在每个 Radio 上（rt 的 .rt-BaseRadioRoot:where(.rt-r-size-N) 就是这么选的）
provide(
  RADIO_GROUP_KEY,
  computed(() => ({
    size: props.size,
    variant: props.variant,
    color: props.color,
    highContrast: props.highContrast,
  })),
)
</script>
