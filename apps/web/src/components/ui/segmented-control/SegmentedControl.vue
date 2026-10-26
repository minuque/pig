<template>
  <ToggleGroupRoot
    data-slot="segmented-control"
    type="single"
    :model-value="modelValue ?? ''"
    :disabled="disabled"
    :data-disabled="disabled || undefined"
    :data-radius="radius"
    class="rt-SegmentedControlRoot"
    :class="[sizeClass, variantClass, props.class]"
    v-bind="$attrs"
    @update:model-value="onValueChange"
  >
    <slot />
    <div class="rt-SegmentedControlIndicator" />
  </ToggleGroupRoot>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { ToggleGroupRoot } from "reka-ui"
import type { Radius } from "@components/ui/button/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** Radix Themes 的分段尺寸：1、2、3 */
    size?: "1" | "2" | "3"
    variant?: "surface" | "classic"
    radius?: Radius
    disabled?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  { size: "2", variant: "surface", disabled: false, class: undefined },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const sizeClass = computed(() => `rt-r-size-${props.size}`)
const variantClass = computed(() => `rt-variant-${props.variant}`)

// rt 的分段控件不会因为再点一次当前项就清空，空值直接丢掉
function onValueChange(value: unknown) {
  if (typeof value === "string" && value) emit("update:modelValue", value)
}
</script>
