<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-accent-color="color"
    :data-radius="radius"
    v-bind="{ ...forwarded, ...$attrs }"
    class="rt-reset rt-SelectTrigger"
    :class="[sizeClass, variantClass, props.class]"
  >
    <span class="rt-SelectTriggerInner">
      <SelectValue :placeholder="placeholder"><slot /></SelectValue>
    </span>

    <SelectIcon class="rt-SelectIcon">
      <AltArrowDownIcon />
    </SelectIcon>
  </SelectTrigger>
</template>

<script setup lang="ts">
import type { SelectTriggerProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectIcon, SelectTrigger, SelectValue, useForwardProps } from "reka-ui"
import type { Radius } from "@components/ui/button/index.js"
import { sizeClass as rtSizeClass } from "@components/ui/rt/size.js"
import { useSelectSize } from "@components/ui/select/select-context.js"
import { AltArrowDownIcon } from "@components/icons/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    SelectTriggerProps & {
      class?: HTMLAttributes["class"]
      variant?: "classic" | "surface" | "soft" | "ghost"
      color?: string
      radius?: Radius
      /** 未选中时显示的文案 */
      placeholder?: string
    }
  >(),
  { class: undefined, variant: "classic", placeholder: "" },
)
const delegatedProps = reactiveOmit(props, "class", "variant", "color", "radius", "placeholder")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectTriggerProps>
const size = useSelectSize()
const sizeClass = computed(() => rtSizeClass(size.value))
const variantClass = computed(() => `rt-variant-${props.variant}`)
</script>
