<template>
  <Primitive
    data-slot="separator"
    :data-accent-color="color"
    :as="as"
    :as-child="asChild"
    :role="decorative ? undefined : 'separator'"
    :aria-orientation="decorative ? undefined : orientation"
    class="rt-Separator"
    :class="[sizeClass, orientationClass, props.class]"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    Pick<PrimitiveProps, "as" | "asChild"> & {
      orientation?: "horizontal" | "vertical"
      size?: "1" | "2" | "3" | "4"
      color?: string
      /** 纯装饰线不进无障碍树，rt 默认如此 */
      decorative?: boolean
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    as: "span",
    asChild: false,
    orientation: "horizontal",
    size: "1",
    color: "gray",
    decorative: true,
    class: undefined,
  },
)
const sizeClass = computed(() => `rt-r-size-${props.size}`)
const orientationClass = computed(() => `rt-r-orientation-${props.orientation}`)
</script>
