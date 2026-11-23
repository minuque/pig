<template>
  <PopoverRoot v-bind="$attrs">
    <slot />
  </PopoverRoot>
</template>

<script setup lang="ts">
import { Popover as PopoverRoot } from "@ui-sdk/vue/popover"

defineOptions({ inheritAttrs: false })
</script>
