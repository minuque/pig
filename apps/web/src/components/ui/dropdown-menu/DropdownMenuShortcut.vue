<template>
  <kbd
    data-slot="dropdown-menu-shortcut"
    class="ms-auto font-sans text-eyebrow font-medium tracking-widest text-ink-faint"
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
