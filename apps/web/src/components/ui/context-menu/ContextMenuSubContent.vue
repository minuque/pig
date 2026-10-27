<template>
  <ContextMenuPortal>
    <ThemeRoot>
      <ContextMenuSubContent
        data-slot="context-menu-sub-content"
        v-bind="forwardedProps"
        :align-offset="-sideOffset"
        :side-offset="1"
        :collision-padding="10"
        class="rt-PopperContent rt-BaseMenuContent rt-BaseMenuSubContent rt-ContextMenuContent rt-ContextMenuSubContent"
        :class="props.class"
      >
        <div class="rt-BaseMenuViewport rt-ContextMenuViewport">
          <slot />
        </div>
      </ContextMenuSubContent>
    </ThemeRoot>
  </ContextMenuPortal>
</template>

<script setup lang="ts">
import type { ContextMenuSubContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuPortal, ContextMenuSubContent, useForwardProps } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"

const props = withDefaults(
  defineProps<ContextMenuSubContentProps & { class?: HTMLAttributes["class"]; size?: number }>(),
  { class: undefined, size: 2 },
)
const sideOffset = props.size * 4
const delegatedProps = reactiveOmit(props, "class", "size")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuSubContentProps>
</script>
