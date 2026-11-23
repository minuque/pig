<template>
  <HoverCardRoot :delay="200" :close-delay="150" v-bind="$attrs">
    <slot />
  </HoverCardRoot>
</template>

<script setup lang="ts">
import { HoverCard as HoverCardRoot } from "@ui-sdk/vue/hover-card"

defineOptions({ inheritAttrs: false })
</script>
