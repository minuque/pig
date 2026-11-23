<template>
  <MenuRadioItem :value="value" :data-tone="color" data-menu-item :class="props.class">
    <slot />
  </MenuRadioItem>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { MenuRadioItem } from "@ui-sdk/vue/menu"
import type { ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<{ class?: HTMLAttributes["class"]; value: string; color?: ToneColor }>(),
  {
    class: undefined,
  },
)
</script>
