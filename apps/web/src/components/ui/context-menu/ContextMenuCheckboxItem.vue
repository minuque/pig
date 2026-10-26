<template>
  <ContextMenuCheckboxItem
    data-slot="context-menu-checkbox-item"
    v-bind="forwardedProps"
    class="rt-BaseMenuItem rt-BaseMenuCheckboxItem rt-ContextMenuItem rt-ContextMenuCheckboxItem"
    :class="props.class"
  >
    <slot />

    <ContextMenuItemIndicator class="rt-BaseMenuItemIndicator rt-ContextMenuItemIndicator">
      <CheckIcon class="rt-BaseMenuItemIndicatorIcon rt-ContextMenuItemIndicatorIcon" />
    </ContextMenuItemIndicator>

    <div v-if="shortcut" class="rt-BaseMenuShortcut rt-ContextMenuShortcut">{{ shortcut }}</div>
  </ContextMenuCheckboxItem>
</template>

<script setup lang="ts">
import type { ContextMenuCheckboxItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuCheckboxItem, ContextMenuItemIndicator, useForwardProps } from "reka-ui"
import { CheckIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<
    ContextMenuCheckboxItemProps & { class?: HTMLAttributes["class"]; shortcut?: string }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "shortcut")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuCheckboxItemProps>
</script>
