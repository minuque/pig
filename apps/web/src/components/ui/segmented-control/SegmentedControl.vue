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
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    /** 尺寸档：s、m、l */
    size?: Size
    variant?: "surface" | "classic"
    radius?: Radius
    disabled?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  { size: "m", variant: "surface", disabled: false, class: undefined },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const sizeClass = computed(() => rtSizeClass(props.size))
const variantClass = computed(() => `rt-variant-${props.variant}`)

// rt 的分段控件不会因为再点一次当前项就清空，空值直接丢掉
function onValueChange(value: unknown) {
  if (typeof value === "string" && value) emit("update:modelValue", value)
}
</script>

<style scoped>
/* 凹槽底 + 细环，指示块内缩 2px，圆角同心 */
[data-slot="segmented-control"] {
  border-radius: var(--radius-card);
  background: var(--bg-sunken);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
}

[data-slot="segmented-control"] .rt-SegmentedControlIndicator::before {
  inset: 2px;
  border-radius: calc(var(--radius-card) - 2px);
  background: var(--bg-raised);
}

[data-slot="segmented-control"].rt-r-size-1 {
  border-radius: var(--radius-control);
}

[data-slot="segmented-control"].rt-r-size-1 .rt-SegmentedControlIndicator::before {
  border-radius: calc(var(--radius-control) - 2px);
}
</style>
