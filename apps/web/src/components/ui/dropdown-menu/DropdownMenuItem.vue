<template>
  <MenuItem
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    :data-tone="variant === 'destructive' ? 'danger' : color"
    data-menu-item
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" data-menu-shortcut>{{ shortcut }}</div>
  </MenuItem>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { MenuItem } from "@ui-sdk/vue/menu"
import type { ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    inset?: boolean
    variant?: "default" | "destructive"
    shortcut?: string
    color?: ToneColor
  }>(),
  { class: undefined, variant: "default" },
)
</script>
