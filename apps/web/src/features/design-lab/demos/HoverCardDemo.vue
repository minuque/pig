<template>
  <Story title="Hover card">
    <Variant title="Default">
      <HoverCard>
        <HoverCardTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Hover me</Button>
          </template>
        </HoverCardTrigger>

        <HoverCardContent>
          <div style="display: flex; flex-direction: column; gap: 4px">
            <strong>Hover card title</strong>
            <span>Supporting text that explains the linked item.</span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </Variant>

    <Variant title="Open">
      <HoverCard default-open>
        <HoverCardTrigger>
          <template #render="{ props: part }">
            <Button v-bind="part" variant="secondary">Always open</Button>
          </template>
        </HoverCardTrigger>

        <HoverCardContent max-width="320px">
          <div style="display: flex; flex-direction: column; gap: 8px">
            <strong>Open hover card</strong>
            <span>Body text with the default padding.</span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; gap: 16px">
        <HoverCard>
          <HoverCardTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" variant="secondary" size="s">Small</Button>
            </template>
          </HoverCardTrigger>

          <HoverCardContent size="s">
            <span>Small padding</span>
          </HoverCardContent>
        </HoverCard>

        <HoverCard>
          <HoverCardTrigger>
            <template #render="{ props: part }">
              <Button v-bind="part" variant="secondary" size="m">Medium</Button>
            </template>
          </HoverCardTrigger>

          <HoverCardContent size="m">
            <span>Medium padding</span>
          </HoverCardContent>
        </HoverCard>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@pig/ui/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pig/ui/hover-card"
</script>
