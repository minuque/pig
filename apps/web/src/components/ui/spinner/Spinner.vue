<template>
  <Loader :size="size" class="animate-spin motion-reduce:animate-none" :class="props.class" />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Loader } from "@lucide/vue"

const props = withDefaults(
  defineProps<{
    size?: number
    class?: HTMLAttributes["class"]
  }>(),
  { size: 16, class: undefined },
)
</script>
