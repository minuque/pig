<template>
  <Story title="Callout">
    <Variant title="Colors">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px">
        <Callout color="neutral">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Neutral</template>
          Neutral callout body text.
        </Callout>

        <Callout color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Info</template>
          Info callout body text.
        </Callout>

        <Callout color="success">
          <template #icon><CircleCheckIcon /></template>
          <template #title>Success</template>
          Success callout body text.
        </Callout>

        <Callout color="warning">
          <template #icon><CircleQuestionMarkIcon /></template>
          <template #title>Warning</template>
          Warning callout body text.
        </Callout>

        <Callout color="destructive">
          <template #icon><CircleExclamationPointIcon /></template>
          <template #title>Destructive</template>
          Destructive callout body text.
        </Callout>
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px">
        <Callout variant="soft" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Soft</template>
          Soft callout body text.
        </Callout>

        <Callout variant="surface" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Surface</template>
          Surface callout body text.
        </Callout>

        <Callout variant="outline" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Outline</template>
          Outline callout body text.
        </Callout>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px">
        <Callout size="s" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Small</template>
          Small callout body text.
        </Callout>

        <Callout size="m" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Medium</template>
          Medium callout body text.
        </Callout>

        <Callout size="l" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Large</template>
          Large callout body text.
        </Callout>
      </div>
    </Variant>

    <Variant title="Dismissible">
      <div style="max-width: 480px">
        <Callout color="warning" dismissible>
          <template #icon><CircleQuestionMarkIcon /></template>
          <template #title>Dismissible</template>
          The close button sits in the top right corner.
        </Callout>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import {
  MessageSquareIcon,
  CircleCheckIcon,
  CircleExclamationPointIcon,
  CircleQuestionMarkIcon,
} from "@components/icons/index.js"
import { Callout } from "@components/ui/callout/index.js"
</script>
