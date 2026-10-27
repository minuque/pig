<template>
  <ContextMenuRadioItem
    data-slot="context-menu-radio-item"
    v-bind="forwardedProps"
    class="rt-BaseMenuItem rt-BaseMenuRadioItem rt-ContextMenuItem rt-ContextMenuRadioItem"
    :class="props.class"
  >
    <slot />

    <ContextMenuItemIndicator class="rt-BaseMenuItemIndicator rt-ContextMenuItemIndicator">
      <CheckIcon class="rt-BaseMenuItemIndicatorIcon rt-ContextMenuItemIndicatorIcon" />
    </ContextMenuItemIndicator>
  </ContextMenuRadioItem>
</template>

<script setup lang="ts">
import type { ContextMenuRadioItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuItemIndicator, ContextMenuRadioItem, useForwardProps } from "reka-ui"
import { CheckIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<ContextMenuRadioItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuRadioItemProps>
</script>
