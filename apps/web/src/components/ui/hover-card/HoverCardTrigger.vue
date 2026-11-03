<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
  <HoverCardTrigger as-child class="rt-HoverCardTrigger">
    <slot />
  </HoverCardTrigger>
</template>

<script setup lang="ts">
import { HoverCardTrigger } from "reka-ui"
</script>
