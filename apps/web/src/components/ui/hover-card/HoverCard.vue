<template>
  <HoverCardRoot :open-delay="200" :close-delay="150" v-bind="$attrs">
    <slot />
  </HoverCardRoot>
</template>

<script setup lang="ts">
import { HoverCardRoot } from "reka-ui"

defineOptions({ inheritAttrs: false })
</script>
