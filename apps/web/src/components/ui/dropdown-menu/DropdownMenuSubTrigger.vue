<template>
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    v-bind="forwardedProps"
    class="rt-BaseMenuItem rt-BaseMenuSubTrigger rt-DropdownMenuItem rt-DropdownMenuSubTrigger"
    :class="props.class"
  >
    <slot />

    <div class="rt-BaseMenuShortcut rt-DropdownMenuShortcut">
      <AltArrowRightIcon class="rt-BaseMenuSubTriggerIcon rt-DropdownMenuSubtriggerIcon" />
    </div>
  </DropdownMenuSubTrigger>
</template>

<script setup lang="ts">
import type { DropdownMenuSubTriggerProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuSubTrigger, useForwardProps } from "reka-ui"
import { AltArrowRightIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<DropdownMenuSubTriggerProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuSubTriggerProps>
</script>
