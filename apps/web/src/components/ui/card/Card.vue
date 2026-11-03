<template>
  <Primitive
    data-slot="card"
    :as="as"
    :as-child="asChild"
    class="rt-reset rt-BaseCard rt-Card"
    :class="[sizeClass, variantClass, props.class]"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "surface" | "classic" | "ghost"
    }
  >(),
  { as: "div", asChild: false, size: "m", variant: "surface", class: undefined },
)
const sizeClass = computed(() => rtSizeClass(props.size))
const variantClass = computed(() => `rt-variant-${props.variant}`)
</script>
