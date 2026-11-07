<template>
  <Story title="正文排版">
    <Variant title="标题、列表、任务、引用、行内码、代码块、表格、Mermaid">
      <AssistantMessage :item="ASSISTANT" session-id="design-lab" />
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import { ASSISTANT } from "@features/design-lab/lib/fixtures.js"
</script>
