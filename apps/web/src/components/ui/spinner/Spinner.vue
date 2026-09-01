<template>
  <Loader2
    :size="size"
    :stroke-width="1.5"
    class="animate-spin motion-reduce:animate-none"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Loader2 } from "lucide-vue-next"

const props = withDefaults(
  defineProps<{
    size?: number
    class?: HTMLAttributes["class"]
  }>(),
  { size: 16, class: undefined },
)
</script>
