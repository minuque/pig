<template>
  <MenuCheckboxItem :value="value ?? id" :data-tone="color" data-menu-item :class="props.class">
    <slot />
    <div v-if="shortcut" data-menu-shortcut>{{ shortcut }}</div>
  </MenuCheckboxItem>
</template>

<script setup lang="ts">
import { useId, type HTMLAttributes } from "vue"
import { MenuCheckboxItem } from "@ui-sdk/vue/menu"
import type { ToneColor } from "../../core/types.js"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    value?: string
    shortcut?: string
    color?: ToneColor
  }>(),
  { class: undefined },
)
const id = useId()
</script>
