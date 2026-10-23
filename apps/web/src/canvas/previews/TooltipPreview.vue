<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button variant="outline">悬停</Button>
    </TooltipTrigger>

    <TooltipContent>示例说明</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
</script>
