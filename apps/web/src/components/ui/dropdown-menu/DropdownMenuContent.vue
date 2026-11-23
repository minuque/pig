<template>
  <MenuContent
    :align="align"
    :side-offset="sideOffset"
    :collision-padding="collisionPadding"
    :data-tone="color"
    data-menu-content
    :data-size="size"
    :class="['reveal-menu', props.class]"
  >
    <div v-if="!bare" data-menu-viewport>
      <slot />
    </div>

    <slot v-else />
  </MenuContent>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { MenuContent } from "@ui-sdk/vue/menu"
import type { MenuSize, ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    align?: "start" | "center" | "end"
    sideOffset?: number
    collisionPadding?: number
    bare?: boolean
    size?: MenuSize
    color?: ToneColor
  }>(),
  {
    class: undefined,
    align: "start",
    sideOffset: 4,
    collisionPadding: 10,
    bare: false,
    size: "m",
  },
)
</script>
