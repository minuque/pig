<template>
  <Primitive
    data-button
    data-slot="icon-button"
    :data-size="size"
    :data-variant="variant"
    :data-accent-color="color"
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
import type { Size } from "@components/ui/size.js"
import type { ButtonVariant, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

defineOptions({ inheritAttrs: false })

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: Size
  color?: string
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
/* 图标按钮：固定方框 + 统一圆角，尺寸档 s=24、m=28、l=40 */
:where([data-slot="icon-button"]) {
  padding: 0;
  border-radius: var(--radius-control);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

/* --- 圆角档 --- */
:where([data-slot="icon-button"][data-radius="none"]) {
  border-radius: 0;
}

:where([data-slot="icon-button"][data-radius="small"]) {
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="icon-button"][data-radius="medium"]) {
  border-radius: var(--radius-control);
}

:where([data-slot="icon-button"][data-radius="large"]) {
  border-radius: var(--radius-card);
}

:where([data-slot="icon-button"][data-radius="full"]) {
  border-radius: var(--radius-pill);
}

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

/* 幽灵图标按钮同样接收固定方框，靠图标居中，不参与负外边距对齐 */
:where([data-slot="icon-button"][data-variant="ghost"]) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  color: var(--fg);
}

:where([data-slot="icon-button"][data-variant="ghost"]:hover) {
  background-color: var(--bg-hover);
  color: var(--fg);
}
</style>
