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
      truncate && 'truncate',
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
      /** 字号档：s、m、l；不传跟父级字号走（与 rt 的 Text 一致，正文内链不会跳出字号） */
      size?: Size
      weight?: "regular" | "medium" | "bold"
      /** auto 只在 hover 时出下划线；always 常驻；none 不出 */
      underline?: "auto" | "always" | "hover" | "none"
      /** accent 色：不传取 --link（见 style/rt.css） */
      color?: string
      highContrast?: boolean
      truncate?: boolean
    }
  >(),
  {
    as: "a",
    asChild: false,
    underline: "auto",
    highContrast: false,
    truncate: false,
    class: undefined,
  },
)
const WEIGHT_CLASS = { regular: "font-normal", medium: "font-medium", bold: "font-bold" } as const
const sizeClass = computed(() => (props.size ? rtSizeClass(props.size) : undefined))
/* rt 的字重与截断类在未引入的 utilities.css 里，用项目自己的原子类顶上 */
const weightClass = computed(() => (props.weight ? WEIGHT_CLASS[props.weight] : undefined))
const underlineClass = computed(() => `rt-underline-${props.underline}`)
</script>
