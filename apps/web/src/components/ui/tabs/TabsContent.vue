<template>
  <TabsPanel :value="value">
    <slot />
  </TabsPanel>
</template>

<script setup lang="ts">
import { TabsPanel } from "@ui-sdk/vue/tabs"

defineProps<{ value: string }>()
</script>

<style>
:where([data-slot="tabs-panel"]) {
  position: relative;
  outline: 0;
}

:where([data-slot="tabs-panel"]:focus-visible) {
  outline: 2px solid var(--focus-color);
}
</style>
