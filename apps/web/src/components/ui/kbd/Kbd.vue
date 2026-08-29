<template>
  <kbd
    data-slot="kbd"
    class="pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-(--radius-xs) bg-muted px-1 font-sans text-eyebrow font-medium text-muted-foreground [&_svg:not([class*='size-'])]:size-3"
    :class="props.class"
  >
    <slot />
  </kbd>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
