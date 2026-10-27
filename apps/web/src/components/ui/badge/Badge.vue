<template>
  <Primitive
    data-slot="badge"
    :data-accent-color="color"
    :data-radius="radius"
    :as="as"
    :as-child="asChild"
    class="rt-reset rt-Badge"
    :class="[sizeClass, variantClass, highContrast && 'rt-high-contrast', props.class]"
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
import type { Radius } from "@components/ui/button/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    Pick<PrimitiveProps, "as" | "asChild"> & {
      /** Radix Themes 的徽标尺寸：1、2、3 */
      size?: "1" | "2" | "3"
      variant?: "solid" | "soft" | "surface" | "outline"
      color?: string
      radius?: Radius
      highContrast?: boolean
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    as: "span",
    asChild: false,
    size: "1",
    variant: "soft",
    highContrast: false,
    class: undefined,
  },
)
const sizeClass = computed(() => `rt-r-size-${props.size}`)
const variantClass = computed(() => `rt-variant-${props.variant}`)
</script>
