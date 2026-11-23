<template>
  <MenuRadioGroup data-menu-group :class="props.class">
    <slot />
  </MenuRadioGroup>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { MenuRadioGroup } from "@ui-sdk/vue/menu"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
