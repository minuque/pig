<template>
  <MenuContent
    side="right"
    align="start"
    :side-offset="2"
    :collision-padding="collisionPadding"
    :data-tone="color"
    data-menu-content
    :data-size="size"
    :class="['reveal-menu', props.class]"
  >
    <div data-menu-viewport>
      <slot />
    </div>
  </MenuContent>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { MenuContent } from "@ui-sdk/vue/menu"
import type { MenuSize, ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    collisionPadding?: number
    size?: MenuSize
    color?: ToneColor
  }>(),
  { class: undefined, collisionPadding: 10, size: "m" },
)
</script>
