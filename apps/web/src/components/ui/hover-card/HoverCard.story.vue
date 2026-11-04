<template>
  <Story title="Hover card">
    <Variant title="Default">
      <HoverCard>
        <HoverCardTrigger as-child>
          <Button variant="soft">Hover me</Button>
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
        <HoverCardTrigger as-child>
          <Button variant="soft">Always open</Button>
        </HoverCardTrigger>

        <HoverCardContent size="l" max-width="320px">
          <div style="display: flex; flex-direction: column; gap: 8px">
            <strong>Larger hover card</strong>
            <span>Body text with the larger padding size.</span>
          </div>
        </HoverCardContent>
      </HoverCard>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; gap: 16px">
        <HoverCard>
          <HoverCardTrigger as-child>
            <Button variant="soft" size="s">Small</Button>
          </HoverCardTrigger>

          <HoverCardContent size="s">
            <span>Small padding</span>
          </HoverCardContent>
        </HoverCard>

        <HoverCard>
          <HoverCardTrigger as-child>
            <Button variant="soft" size="m">Medium</Button>
          </HoverCardTrigger>

          <HoverCardContent size="m">
            <span>Medium padding</span>
          </HoverCardContent>
        </HoverCard>

        <HoverCard>
          <HoverCardTrigger as-child>
            <Button variant="soft" size="l">Large</Button>
          </HoverCardTrigger>

          <HoverCardContent size="l">
            <span>Large padding</span>
          </HoverCardContent>
        </HoverCard>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Button } from "@components/ui/button/index.js"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./index.js"
</script>
