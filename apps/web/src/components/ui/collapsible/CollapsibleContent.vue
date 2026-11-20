<template>
  <CollapsibleContent
    data-slot="collapsible-content"
    v-bind="forwarded"
    class="collapsible-content"
    :class="props.class"
  >
    <slot />
  </CollapsibleContent>
</template>

<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CollapsibleContent, useForwardProps } from "reka-ui"

const props = defineProps<
  CollapsibleContentProps & {
    class?: HTMLAttributes["class"] | undefined
  }
>()
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<CollapsibleContentProps>
</script>
