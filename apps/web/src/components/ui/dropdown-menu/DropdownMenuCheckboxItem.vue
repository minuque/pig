<template>
  <DropdownMenuCheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    class="rt-BaseMenuItem rt-BaseMenuCheckboxItem rt-DropdownMenuItem rt-DropdownMenuCheckboxItem"
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" class="rt-BaseMenuShortcut rt-DropdownMenuShortcut">{{ shortcut }}</div>
  </DropdownMenuCheckboxItem>
</template>

<script setup lang="ts">
import type { DropdownMenuCheckboxItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuCheckboxItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    DropdownMenuCheckboxItemProps & {
      class?: HTMLAttributes["class"]
      shortcut?: string
      color?: string
    }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "shortcut", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuCheckboxItemProps>
</script>

<style scoped>
/* 选中态用 accent 淡底标出，不在左侧留白放勾：项本身已有前置图标，双标记会挤 */
.rt-DropdownMenuCheckboxItem[data-state="checked"] {
  background-color: var(--accent-a3);
}

.rt-DropdownMenuCheckboxItem[data-state="checked"][data-highlighted] {
  background-color: var(--accent-a4);
}
</style>
