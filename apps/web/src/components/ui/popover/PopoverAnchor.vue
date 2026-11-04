<template>
  <!-- 不套触发元素时用 reference 指一个既有元素，浮层就贴在它旁边 -->
  <PopoverAnchorPrimitive as="span" v-bind="$attrs">
    <slot />
  </PopoverAnchorPrimitive>
</template>

<script setup lang="ts">
import { PopoverAnchor as PopoverAnchorPrimitive } from "reka-ui"

defineOptions({ inheritAttrs: false })
</script>
