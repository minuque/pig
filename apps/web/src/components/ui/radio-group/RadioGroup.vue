<template>
  <RadioGroupRoot data-slot="radio-group" v-bind="forwardedProps" :class="props.class">
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

// 尺寸、变体、color 与 highContrast 挂在每个 Radio 上，由 data 属性选样式
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

<style>
:where([data-slot="radio-group"]) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}
</style>
