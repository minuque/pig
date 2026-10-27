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
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<
    SwitchRootProps<boolean> & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "classic" | "surface" | "soft"
      color?: string
      radius?: "none" | "small" | "medium" | "large" | "full"
    }
  >(),
  { class: undefined, size: "m", variant: "surface" },
)
const emits = defineEmits<SwitchRootEmits<boolean>>()
const delegatedProps = reactiveOmit(props, "class", "size", "variant", "color", "radius")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<
  SwitchRootProps<boolean>
>
const sizeClass = rtSizeClass(props.size)
const variantClass = `rt-variant-${props.variant}`
</script>
