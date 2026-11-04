<template>
  <PopoverRoot v-bind="$attrs">
    <slot />
  </PopoverRoot>
</template>

<script setup lang="ts">
import { PopoverRoot } from "reka-ui"

defineOptions({ inheritAttrs: false })
</script>
