<template>
  <ContextMenuCheckboxItem
    data-slot="context-menu-checkbox-item"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    class="rt-BaseMenuItem rt-BaseMenuCheckboxItem rt-ContextMenuItem rt-ContextMenuCheckboxItem"
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" class="rt-BaseMenuShortcut rt-ContextMenuShortcut">{{ shortcut }}</div>
  </ContextMenuCheckboxItem>
</template>

<script setup lang="ts">
import type { ContextMenuCheckboxItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuCheckboxItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    ContextMenuCheckboxItemProps & {
      class?: HTMLAttributes["class"]
      shortcut?: string
      color?: string
    }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "shortcut", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuCheckboxItemProps>
</script>

<style scoped>
/* 选中态用 accent 淡底标出，不在左侧留白放勾：项本身已有前置图标，双标记会挤 */
.rt-ContextMenuCheckboxItem[data-state="checked"] {
  background-color: var(--accent-a3);
}

.rt-ContextMenuCheckboxItem[data-state="checked"][data-highlighted] {
  background-color: var(--accent-a4);
}
</style>
