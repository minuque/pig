<template>
  <ToggleGroupItem
    data-slot="segmented-control-item"
    v-bind="forwardedProps"
    class="rt-reset rt-SegmentedControlItem"
    :class="props.class"
  >
    <span class="rt-SegmentedControlItemLabel">
      <span class="rt-SegmentedControlItemLabelActive"><slot /></span>
      <span class="rt-SegmentedControlItemLabelInactive" aria-hidden="true"><slot /></span>
    </span>
  </ToggleGroupItem>
</template>

<script setup lang="ts">
import type { ToggleGroupItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ToggleGroupItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<ToggleGroupItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ToggleGroupItemProps>
</script>

<style scoped>
[data-slot="segmented-control-item"] {
  color: var(--fg-secondary);
}

[data-slot="segmented-control-item"]:is([data-state="on"], :not([disabled]):hover) {
  color: var(--fg);
}

[data-slot="segmented-control-item"] .rt-SegmentedControlItemLabel {
  background: none;
}

[data-slot="segmented-control-item"] .rt-SegmentedControlItemLabelInactive {
  font-weight: var(--font-weight-medium);
}
</style>
