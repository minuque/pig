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
    data-slot="alert"
    class="relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90"
    :class="props.class"
    role="alert"
  >
    <slot />
  </div>
</template>
