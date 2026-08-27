<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
  }>(),
  { class: undefined },
)
</script>

<template>
  <div
    data-slot="alert-description"
    class="text-muted-foreground col-start-2 text-sm [&_p]:leading-relaxed"
    :class="props.class"
  >
    <slot />
  </div>
</template>
