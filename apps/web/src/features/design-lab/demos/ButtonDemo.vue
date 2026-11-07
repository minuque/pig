<template>
  <Story title="Button">
    <Variant title="Variants">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Button variant="classic">Classic</Button>
        <Button variant="solid">Solid</Button>
        <Button variant="soft">Soft</Button>
        <Button variant="surface">Surface</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    </Variant>

    <Variant title="Sizes">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Button size="s">Small</Button>
        <Button size="m">Medium</Button>
        <Button size="l">Large</Button>
      </div>
    </Variant>

    <Variant title="States">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Button variant="solid">Default</Button>
        <Button variant="solid" loading>Loading</Button>
        <Button variant="solid" disabled>Disabled</Button>
        <Button variant="outline" loading>Loading</Button>
      </div>
    </Variant>

    <Variant title="High contrast">
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <Button variant="solid" high-contrast>Solid</Button>
        <Button variant="soft" high-contrast>Soft</Button>
        <Button variant="surface" high-contrast>Surface</Button>
        <Button variant="outline" high-contrast>Outline</Button>
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Button } from "@components/ui/button/index.js"
</script>
