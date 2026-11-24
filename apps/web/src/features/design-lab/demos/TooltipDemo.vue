<template>
  <Story title="Tooltip">
    <Variant title="Default">
      <Tooltip>
        <TooltipTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Hover me</Button>
          </template>
        </TooltipTrigger>

        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </Variant>

    <Variant title="Open">
      <Tooltip default-open>
        <TooltipTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Always open</Button>
          </template>
        </TooltipTrigger>

        <TooltipContent>Tooltip text</TooltipContent>
      </Tooltip>
    </Variant>

    <Variant title="Sides">
      <div style="display: flex; flex-wrap: wrap; gap: 24px; padding: 48px">
        <Tooltip>
          <TooltipTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" variant="secondary">Top</Button>
            </template>
          </TooltipTrigger>

          <TooltipContent side="top">Top tooltip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" variant="secondary">Right</Button>
            </template>
          </TooltipTrigger>

          <TooltipContent side="right">Right tooltip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" variant="secondary">Bottom</Button>
            </template>
          </TooltipTrigger>

          <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" variant="secondary">Left</Button>
            </template>
          </TooltipTrigger>

          <TooltipContent side="left">Left tooltip</TooltipContent>
        </Tooltip>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@pig/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
</script>
