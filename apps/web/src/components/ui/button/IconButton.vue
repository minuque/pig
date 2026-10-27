<template>
  <Primitive
    data-slot="icon-button"
    :data-accent-color="color"
    :data-radius="radius"
    :data-disabled="disabled || loading ? '' : undefined"
    :as="as"
    :as-child="asChild"
    :class="['rt-reset', 'rt-BaseButton', 'rt-IconButton', extracted.class, props.class]"
    :style="extracted.style"
    v-bind="{ ...extracted.attrs, ...$attrs }"
  >
    <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"
import { extractProps, type PropDefs } from "@components/ui/rt/props.js"
import type { ButtonSize, ButtonVariant, HighContrast, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: ButtonSize
  color?: string
  radius?: Radius
  highContrast?: HighContrast
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  asChild: false,
  variant: "solid",
  size: "2",
  loading: false,
  disabled: false,
})
const DEFS: PropDefs = {
  size: { type: "enum", values: ["1", "2", "3", "4"], default: "2", className: "rt-r-size" },
  variant: {
    type: "enum",
    values: ["classic", "solid", "soft", "surface", "outline", "ghost", "ghost-offset"],
    default: "solid",
    className: "rt-variant",
  },
  highContrast: { type: "boolean", className: "rt-high-contrast" },
  loading: { type: "boolean", className: "rt-loading" },
}
const extracted = computed(() => extractProps(props as Record<string, unknown>, DEFS))
</script>
