<template>
  <ContextMenuSubTrigger
    data-slot="context-menu-sub-trigger"
    v-bind="forwardedProps"
    class="rt-BaseMenuItem rt-BaseMenuSubTrigger rt-ContextMenuItem rt-ContextMenuSubTrigger"
    :class="props.class"
  >
    <slot />

    <div class="rt-BaseMenuShortcut rt-ContextMenuShortcut">
      <AltArrowRightIcon class="rt-BaseMenuSubTriggerIcon rt-ContextMenuSubtriggerIcon" />
    </div>
  </ContextMenuSubTrigger>
</template>

<script setup lang="ts">
import type { ContextMenuSubTriggerProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuSubTrigger, useForwardProps } from "reka-ui"
import { AltArrowRightIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<ContextMenuSubTriggerProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuSubTriggerProps>
</script>
