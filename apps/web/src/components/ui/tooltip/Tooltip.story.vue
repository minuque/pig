<template>
  <Story title="Tooltip">
    <Variant title="Default">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="soft">Hover me</Button>
        </TooltipTrigger>

        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </Variant>

    <Variant title="Open">
      <Tooltip default-open>
        <TooltipTrigger as-child>
          <Button variant="soft">Always open</Button>
        </TooltipTrigger>

        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </Variant>

    <Variant title="Sides">
      <div style="display: flex; flex-wrap: wrap; gap: 24px; padding: 48px">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="soft">Top</Button>
          </TooltipTrigger>

          <TooltipContent side="top">Top tooltip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="soft">Right</Button>
          </TooltipTrigger>

          <TooltipContent side="right">Right tooltip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="soft">Bottom</Button>
          </TooltipTrigger>

          <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="soft">Left</Button>
          </TooltipTrigger>

          <TooltipContent side="left">Left tooltip</TooltipContent>
        </Tooltip>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Button } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "./index.js"
</script>
