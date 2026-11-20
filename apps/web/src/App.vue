<template>
  <TooltipProvider>
    <RouterView />
  </TooltipProvider>
</template>

<script setup lang="ts">
import { TooltipProvider } from "@components/ui/tooltip/index.js"
</script>
