<template>
  <Primitive
    data-slot="link"
    :as="as"
    :as-child="asChild"
    :data-accent-color="color"
    class="rt-reset rt-Text rt-Link"
    :class="[
      sizeClass,
      weightClass,
      underlineClass,
      { 'rt-truncate': truncate },
      highContrast && 'rt-high-contrast',
      props.class,
    ]"
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
      /** 字号档：s、m、l */
      size?: Size
      weight?: "regular" | "medium" | "bold"
      /** auto 只在 hover 时出下划线；always 常驻；none 不出 */
      underline?: "auto" | "always" | "hover" | "none"
      /** accent 色：不传跟随主题 */
      color?: string
      highContrast?: boolean
      truncate?: boolean
    }
  >(),
  {
    as: "a",
    asChild: false,
    size: "m",
    weight: "regular",
    underline: "auto",
    highContrast: false,
    truncate: false,
    class: undefined,
  },
)
const sizeClass = computed(() => rtSizeClass(props.size))
const weightClass = computed(() => `rt-r-weight-${props.weight}`)
const underlineClass = computed(() => `rt-underline-${props.underline}`)
</script>
