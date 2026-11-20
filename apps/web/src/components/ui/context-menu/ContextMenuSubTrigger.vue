<template>
  <ContextMenuSubTrigger
    data-slot="context-menu-sub-trigger"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    data-menu-item
    data-menu-sub-trigger
    :class="props.class"
  >
    <slot />

    <div data-menu-shortcut>
      <ChevronRightIcon data-menu-sub-trigger-icon />
    </div>
  </ContextMenuSubTrigger>
</template>

<script setup lang="ts">
import type { ContextMenuSubTriggerProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuSubTrigger, useForwardProps } from "reka-ui"
import { ChevronRightIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<ContextMenuSubTriggerProps & { class?: HTMLAttributes["class"]; color?: string }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuSubTriggerProps>
</script>
