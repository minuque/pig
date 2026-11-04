<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
  <PopoverTriggerPrimitive as-child class="rt-PopoverTrigger">
    <slot />
  </PopoverTriggerPrimitive>
</template>

<script setup lang="ts">
import { PopoverTrigger as PopoverTriggerPrimitive } from "reka-ui"
</script>
