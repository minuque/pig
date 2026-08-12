<template>
  <div
    class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    :class="[
      variant === 'default'
        ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80'
        : variant === 'destructive'
          ? 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80'
          : 'border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ]"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: "default" | "destructive" | "outline";
  }>(),
  { variant: "default" },
);
</script>
