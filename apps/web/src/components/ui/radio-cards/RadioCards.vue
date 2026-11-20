<template>
  <RadioGroupRoot
    data-slot="radio-cards"
    :data-accent-color="color"
    :data-size="size"
    :data-variant="variant"
    :disabled="disabled"
    :data-disabled="disabled || undefined"
    :class="props.class"
    :style="gridStyle"
    v-bind="forwarded"
  >
    <slot />
  </RadioGroupRoot>
</template>

<script setup lang="ts">
import type { RadioGroupRootEmits, RadioGroupRootProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupRoot, useForwardPropsEmits } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    RadioGroupRootProps & {
      class?: HTMLAttributes["class"]
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "surface" | "classic"
      /** accent 色：选中项描边与圆点跟随它 */
      color?: string
      disabled?: boolean
      /** 列宽规则，直接落成 grid-template-columns */
      columns?: string
      /** rt 的间距档 1-9，默认 4 */
      gap?: string
    }
  >(),
  {
    class: undefined,
    size: "m",
    variant: "surface",
    disabled: false,
    columns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "4",
  },
)
const emits = defineEmits<RadioGroupRootEmits>()
const delegatedProps = reactiveOmit(
  props,
  "class",
  "size",
  "variant",
  "color",
  "disabled",
  "columns",
  "gap",
)
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<RadioGroupRootProps>
/** 列宽与间距直接落成内联属性：rt 的 Grid 工具类在 utilities.css 里，本项目没引那层 */
const gridStyle = computed(() => ({
  gridTemplateColumns: props.columns,
  gap: `var(--space-${props.gap})`,
}))
</script>

<style>
/* 卡片式单选：网格由调用方的列宽规则决定，字号随尺寸档 */
:where([data-slot="radio-cards"]) {
  display: grid;
  cursor: default;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="radio-cards"][data-size="l"]) {
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}
</style>
