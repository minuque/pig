<template>
  <ContextMenuSeparator
    data-slot="context-menu-separator"
    v-bind="forwardedProps"
    class="mx-(--spacing-xs) my-(--spacing-xxs) h-px bg-border"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { ContextMenuSeparatorProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuSeparator, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<ContextMenuSeparatorProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuSeparatorProps>
</script>
