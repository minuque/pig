<template>
  <ButtonPrimitive
    v-bind="{ ...$attrs, ...(props.onClick && { onClick: chainClick(props.onClick) }) }"
    data-button
    data-icon-button
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    :data-loading="loading || undefined"
    :disabled="disabled || loading"
    :class="props.class"
  >
    <template v-if="$slots.render" #render="part">
      <slot name="render" v-bind="part" />
    </template>

    <template v-else #default>
      <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
    </template>
  </ButtonPrimitive>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Button as ButtonPrimitive } from "@ui-sdk/vue/button"
import type { Size, ToneColor, Radius } from "../../core/types.js"
import type { ButtonVariant } from "./index.js"
import ButtonContent from "./ButtonContent.vue"
import { chainClick } from "./press.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: Size
    color?: ToneColor
    radius?: Radius
    loading?: boolean
    disabled?: boolean
    class?: HTMLAttributes["class"]
    onClick?: Parameters<typeof chainClick>[0]
  }>(),
  {
    variant: "solid",
    size: "m",
    loading: false,
    disabled: false,
    class: undefined,
  },
)
</script>

<style>
:where([data-icon-button][data-size="s"]) {
  height: var(--control-xs);
  inline-size: var(--control-xs);
}

:where([data-icon-button][data-size="m"]) {
  height: var(--control-sm);
  inline-size: var(--control-sm);
}
</style>
