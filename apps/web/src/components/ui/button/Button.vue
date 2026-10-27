<template>
  <Primitive
    data-slot="button"
    :data-accent-color="color"
    :data-radius="radius"
    :data-disabled="disabled || loading ? '' : undefined"
    :as="as"
    :as-child="asChild"
    :class="['rt-reset', 'rt-BaseButton', 'rt-Button', extracted.class, props.class]"
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
import { RT_SIZE, type Size } from "@components/ui/rt/size.js"
import type { ButtonVariant, HighContrast, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: Size
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
  size: "m",
  loading: false,
  disabled: false,
})
const DEFS: PropDefs = {
  size: {
    type: "enum",
    values: ["s", "m", "l"],
    default: "m",
    className: "rt-r-size",
    valueMap: RT_SIZE,
  },
  variant: {
    type: "enum",
    values: ["classic", "solid", "soft", "surface", "outline", "ghost"],
    default: "solid",
    className: "rt-variant",
  },
  highContrast: { type: "boolean", className: "rt-high-contrast" },
  loading: { type: "boolean", className: "rt-loading" },
}
const extracted = computed(() =>
  extractProps(props as Record<string, unknown>, DEFS, ["color", "radius"]),
)
</script>
