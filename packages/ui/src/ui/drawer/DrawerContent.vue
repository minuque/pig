<template>
  <DrawerContentPrimitive v-bind="$attrs" :class="props.class">
    <slot />
  </DrawerContentPrimitive>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { DrawerContent as DrawerContentPrimitive } from "@ui-sdk/vue/drawer"

defineOptions({ inheritAttrs: false })

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<style>
:where([data-slot="drawer-viewport"]) {
  position: fixed;
  inset: var(--drawer-inset, 0);
  display: flex;
  justify-content: flex-end;
  padding: var(--space-xs);
  pointer-events: none;
}

:where([data-slot="drawer-viewport"][data-side="left"]) {
  justify-content: flex-start;
}

:where([data-slot="drawer-content"]) {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  block-size: 100%;
  overflow: hidden;
  border-radius: var(--radius-dialog);
  corner-shape: round;
  background-color: var(--bg);
  box-shadow: var(--shadow-dialog);
  color: var(--fg);
  outline: none;
  pointer-events: auto;
}
</style>
