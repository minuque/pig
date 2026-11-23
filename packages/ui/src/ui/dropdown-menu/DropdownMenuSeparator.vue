<template>
  <MenuSeparator data-menu-separator :class="props.class" />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { MenuSeparator } from "@ui-sdk/vue/menu"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
