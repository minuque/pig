<template>
  <CollapsiblePanel class="collapsible-content">
    <slot />
  </CollapsiblePanel>
</template>

<script setup lang="ts">
import { CollapsiblePanel } from "@ui-sdk/vue/collapsible"
</script>
