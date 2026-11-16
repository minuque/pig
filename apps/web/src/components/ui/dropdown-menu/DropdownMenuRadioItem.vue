<template>
  <DropdownMenuRadioItem
    data-slot="dropdown-menu-radio-item"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    class="rt-BaseMenuItem rt-BaseMenuRadioItem rt-DropdownMenuItem rt-DropdownMenuRadioItem"
    :class="props.class"
  >
    <slot />
  </DropdownMenuRadioItem>
</template>

<script setup lang="ts">
import type { DropdownMenuRadioItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuRadioItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<DropdownMenuRadioItemProps & { class?: HTMLAttributes["class"]; color?: string }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuRadioItemProps>
</script>

<style scoped>
/* 选中态用 --btn-selected 标出，比悬停深一档；不在左侧留白放勾：项本身已有前置图标，双标记会挤 */
.rt-DropdownMenuRadioItem[data-state="checked"] {
  background-color: var(--btn-selected);
}
</style>
