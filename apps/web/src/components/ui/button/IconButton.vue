<template>
  <Primitive
    data-button
    data-slot="icon-button"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    :data-disabled="disabled || loading ? '' : undefined"
    :data-loading="loading || undefined"
    :disabled="disabled || loading"
    :as="as"
    :as-child="asChild"
    :class="props.class"
    v-bind="$attrs"
  >
    <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import type { Size, ToneColor } from "@/types/ui-type.js"
import type { ButtonVariant, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

defineOptions({ inheritAttrs: false })

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: Size
  color?: ToneColor
  radius?: Radius
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  asChild: false,
  variant: "solid",
  size: "m",
  loading: false,
  disabled: false,
  class: undefined,
})
</script>

<style>
/* 图标按钮：固定方框，尺寸档 s=24、m=28、l=36；外观与圆角沿用 Button 的 data-button 规则 */
:where([data-slot="icon-button"][data-size="s"]) {
  height: var(--space-lg);
  inline-size: var(--space-lg);
}

:where([data-slot="icon-button"][data-size="m"]) {
  height: var(--control-sm);
  inline-size: var(--control-sm);
}

:where([data-slot="icon-button"][data-size="l"]) {
  height: var(--control-lg);
  inline-size: var(--control-lg);
}
</style>
