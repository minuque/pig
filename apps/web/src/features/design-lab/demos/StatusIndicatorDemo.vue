<template>
  <Story title="StatusIndicator">
    <Variant title="Dots">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <StatusIndicator status="idle" label="Idle" />
        <StatusIndicator status="running" label="Running" />
        <StatusIndicator status="running" pulse label="Needs attention" />
        <StatusIndicator status="waiting" label="Waiting" />
        <StatusIndicator status="success" label="Done" />
        <StatusIndicator status="warning" label="Warning" />
        <StatusIndicator status="error" label="Failed" />
        <StatusIndicator status="draft" label="Draft" />
      </div>
    </Variant>

    <Variant title="Icons">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px">
        <StatusIndicator appearance="icon" status="idle" label="Idle" />
        <StatusIndicator appearance="icon" status="running" label="Running" />
        <StatusIndicator appearance="icon" status="success" label="Done" />
        <StatusIndicator appearance="icon" status="warning" label="Warning" />
        <StatusIndicator appearance="icon" status="error" label="Failed" />
        <StatusIndicator appearance="icon" status="draft" label="Draft" />
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; align-items: center; gap: 16px">
        <StatusIndicator status="running" size="s" aria-label="Small running" />
        <StatusIndicator status="running" size="m" aria-label="Medium running" />
        <StatusIndicator appearance="icon" status="success" size="s" aria-label="Small success" />
        <StatusIndicator appearance="icon" status="success" size="m" aria-label="Medium success" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { StatusIndicator } from "@pig/ui/status-indicator"
</script>
