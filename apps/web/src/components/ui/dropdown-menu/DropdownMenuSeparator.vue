<template>
  <DropdownMenuSeparator
    data-slot="dropdown-menu-separator"
    v-bind="forwardedProps"
    class="mx-(--space-xs) my-(--space-xxs) h-px bg-[color:var(--hairline)]"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { DropdownMenuSeparatorProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuSeparator, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<DropdownMenuSeparatorProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuSeparatorProps>
</script>
