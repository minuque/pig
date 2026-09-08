<template>
  <div
    data-slot="alert-description"
    class="min-w-0 text-muted-foreground text-body-sm [&_p]:leading-relaxed"
    :class="props.class"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
  }>(),
  { class: undefined },
)
</script>
