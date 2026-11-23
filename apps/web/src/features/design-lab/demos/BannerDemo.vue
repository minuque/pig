<template>
  <Story title="Banner">
    <Variant title="Colors">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px">
        <Banner color="neutral">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Neutral</template>
          Neutral banner body text.
        </Banner>

        <Banner color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Info</template>
          Info banner body text.
        </Banner>

        <Banner color="success">
          <template #icon><CircleCheckIcon /></template>
          <template #title>Success</template>
          Success banner body text.
        </Banner>

        <Banner color="warning">
          <template #icon><CircleQuestionMarkIcon /></template>
          <template #title>Warning</template>
          Warning banner body text.
        </Banner>

        <Banner color="danger">
          <template #icon><CircleExclamationPointIcon /></template>
          <template #title>Danger</template>
          Danger banner body text.
        </Banner>
      </div>
    </Variant>

    <Variant title="Variants">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px">
        <Banner variant="soft" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Soft</template>
          Soft banner body text.
        </Banner>

        <Banner variant="surface" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Surface</template>
          Surface banner body text.
        </Banner>

        <Banner variant="outline" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Outline</template>
          Outline banner body text.
        </Banner>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 480px">
        <Banner size="s" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Small</template>
          Small banner body text.
        </Banner>

        <Banner size="m" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Medium</template>
          Medium banner body text.
        </Banner>

        <Banner size="l" color="info">
          <template #icon><MessageSquareIcon /></template>
          <template #title>Large</template>
          Large banner body text.
        </Banner>
      </div>
    </Variant>

    <Variant title="Dismissible">
      <div style="max-width: 480px">
        <Banner color="warning" dismissible>
          <template #icon><CircleQuestionMarkIcon /></template>
          <template #title>Dismissible</template>
          The close button sits in the top right corner.
        </Banner>
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
import { Banner } from "@pig/ui/banner"
</script>
