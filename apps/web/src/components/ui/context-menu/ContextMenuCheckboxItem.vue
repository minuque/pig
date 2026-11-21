<template>
  <ContextMenuCheckboxItem
    data-slot="context-menu-checkbox-item"
    v-bind="forwardedProps"
    :data-tone="props.color"
    data-menu-item
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" data-menu-shortcut>{{ shortcut }}</div>
  </ContextMenuCheckboxItem>
</template>

<script setup lang="ts">
import type { ToneColor } from "@/types/ui-type.js"
import type { ContextMenuCheckboxItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuCheckboxItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    ContextMenuCheckboxItemProps & {
      class?: HTMLAttributes["class"]
      shortcut?: string
      color?: ToneColor
    }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "shortcut", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuCheckboxItemProps>
</script>
