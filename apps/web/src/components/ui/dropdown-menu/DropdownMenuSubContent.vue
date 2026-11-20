<template>
  <DropdownMenuPortal>
    <DropdownMenuSubContent
      data-slot="dropdown-menu-sub-content"
      v-bind="forwardedProps"
      :data-accent-color="accentColor"
      :align-offset="-4"
      :side-offset="1"
      :collision-padding="10"
      data-menu-content
      :data-size="size"
      class="reveal-menu"
      :class="props.class"
    >
      <div data-menu-viewport>
        <slot />
      </div>
    </DropdownMenuSubContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuSubContentProps } from "reka-ui"
import { computed, type ComputedRef, type HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuPortal, DropdownMenuSubContent, useForwardProps } from "reka-ui"
import { useMenuContent } from "@components/ui/menu-context.js"

const props = withDefaults(
  defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const menu = useMenuContent()
const size = computed(() => menu?.size.value ?? "m")
const accentColor = computed(() => menu?.color.value)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuSubContentProps>
</script>
