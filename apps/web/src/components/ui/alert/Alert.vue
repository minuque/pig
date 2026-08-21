<template>
  <div
    data-slot="alert"
    role="alert"
    :class="
      cn(
        'relative grid w-full items-start gap-y-0.5 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm grid-cols-[0_1fr] has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
        variant === 'destructive'
          ? 'text-destructive *:data-[slot=alert-description]:text-destructive/90'
          : 'text-ink',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@utils/utils.js";

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    variant?: "default" | "destructive";
  }>(),
  {
    class: undefined,
    variant: "default",
  },
);
</script>
