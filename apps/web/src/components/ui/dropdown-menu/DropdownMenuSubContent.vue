<template>
  <DropdownMenuPortal>
    <ThemeRoot>
      <DropdownMenuSubContent
        data-slot="dropdown-menu-sub-content"
        v-bind="forwardedProps"
        :align-offset="-sideOffset"
        :side-offset="1"
        :collision-padding="10"
        class="rt-PopperContent rt-BaseMenuContent rt-BaseMenuSubContent rt-DropdownMenuContent rt-DropdownMenuSubContent"
        :class="props.class"
      >
        <div class="rt-BaseMenuViewport rt-DropdownMenuViewport">
          <slot />
        </div>
      </DropdownMenuSubContent>
    </ThemeRoot>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuSubContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuPortal, DropdownMenuSubContent, useForwardProps } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"

const props = withDefaults(
  defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes["class"]; size?: number }>(),
  { class: undefined, size: 2 },
)
const sideOffset = props.size * 4
const delegatedProps = reactiveOmit(props, "class", "size")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuSubContentProps>
</script>
