<template>
  <PopoverAnchorPrimitive as="span" v-bind="$attrs">
    <slot />
  </PopoverAnchorPrimitive>
</template>

<script setup lang="ts">
import { PopoverAnchor as PopoverAnchorPrimitive } from "reka-ui"

defineOptions({ inheritAttrs: false })
</script>
