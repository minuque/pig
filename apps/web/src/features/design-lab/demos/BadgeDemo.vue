<template>
  <Story title="Badge">
    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Badge variant="solid">Solid</Badge>
        <Badge variant="soft">Soft</Badge>
        <Badge variant="surface">Surface</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Badge size="s">Small</Badge>
        <Badge size="m">Medium</Badge>
      </div>
    </Variant>

    <Variant title="Colors">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Badge color="neutral">Gray</Badge>
        <Badge color="success">Green</Badge>
        <Badge color="warning">Orange</Badge>
        <Badge color="danger">Red</Badge>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Badge } from "@pig/ui/badge"
</script>
