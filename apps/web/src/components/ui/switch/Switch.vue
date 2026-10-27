<template>
  <SwitchRoot
    data-slot="switch"
    v-bind="forwarded"
    :data-accent-color="color"
    :data-radius="radius"
    class="rt-SwitchRoot"
    :class="[sizeClass, variantClass, props.class]"
  >
    <SwitchThumb class="rt-SwitchThumb" />
  </SwitchRoot>
</template>

<script setup lang="ts">
import type { SwitchRootEmits, SwitchRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui"

const props = withDefaults(
  defineProps<
    SwitchRootProps<boolean> & {
      class?: HTMLAttributes["class"]
      /** Radix Themes 的开关尺寸：1 小、2 默认、3 大 */
      size?: "1" | "2" | "3"
      variant?: "classic" | "surface" | "soft"
      color?: string
      radius?: "none" | "small" | "medium" | "large" | "full"
    }
  >(),
  { class: undefined, size: "2", variant: "surface" },
)
const emits = defineEmits<SwitchRootEmits<boolean>>()
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "radius")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<
  SwitchRootProps<boolean>
>
const sizeClass = `rt-r-size-${props.size}`
const variantClass = `rt-variant-${props.variant}`
</script>
