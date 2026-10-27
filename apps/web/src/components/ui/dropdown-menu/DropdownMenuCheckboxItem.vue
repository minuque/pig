<template>
  <DropdownMenuCheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    v-bind="forwardedProps"
    class="rt-BaseMenuItem rt-BaseMenuCheckboxItem rt-DropdownMenuItem rt-DropdownMenuCheckboxItem"
    :class="props.class"
  >
    <slot />

    <DropdownMenuItemIndicator class="rt-BaseMenuItemIndicator rt-DropdownMenuItemIndicator">
      <CheckIcon class="rt-BaseMenuItemIndicatorIcon rt-DropdownMenuItemIndicatorIcon" />
    </DropdownMenuItemIndicator>

    <div v-if="shortcut" class="rt-BaseMenuShortcut rt-DropdownMenuShortcut">{{ shortcut }}</div>
  </DropdownMenuCheckboxItem>
</template>

<script setup lang="ts">
import type { DropdownMenuCheckboxItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuCheckboxItem, DropdownMenuItemIndicator, useForwardProps } from "reka-ui"
import { CheckIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<
    DropdownMenuCheckboxItemProps & { class?: HTMLAttributes["class"]; shortcut?: string }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "shortcut")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuCheckboxItemProps>
</script>
