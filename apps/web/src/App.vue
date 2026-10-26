<template>
  <ThemeRoot>
    <TooltipProvider>
      <RouterView />
    </TooltipProvider>
  </ThemeRoot>
</template>

<script setup lang="ts">
import { ThemeRoot } from "@components/ui/rt/index.js"
import { TooltipProvider } from "@components/ui/tooltip/index.js"
</script>
