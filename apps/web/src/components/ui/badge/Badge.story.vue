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
        <Badge size="l">Large</Badge>
      </div>
    </Variant>

    <Variant title="Colors">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Badge color="indigo">Indigo</Badge>
        <Badge color="green">Green</Badge>
        <Badge color="orange">Orange</Badge>
        <Badge color="red">Red</Badge>
      </div>
    </Variant>

    <Variant title="High contrast">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Badge variant="solid" high-contrast>Solid</Badge>
        <Badge variant="soft" high-contrast>Soft</Badge>
        <Badge variant="surface" high-contrast>Surface</Badge>
        <Badge variant="outline" high-contrast>Outline</Badge>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import { Badge } from "./index.js"
</script>
