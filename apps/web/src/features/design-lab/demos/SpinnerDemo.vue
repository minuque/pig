<template>
  <Story title="Spinner">
    <Variant title="Sizes">
      <div style="display: flex; align-items: center; gap: 16px">
        <Spinner size="s" label="Small loading" />
        <Spinner size="m" label="Medium loading" />
      </div>
    </Variant>

    <Variant title="Colors">
      <div style="display: flex; align-items: center; gap: 16px">
        <Spinner size="m" label="Default loading" />
        <Spinner size="m" label="Indigo loading" style="color: var(--tone)" />
        <Spinner size="m" label="Red loading" style="color: var(--danger-solid)" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Spinner } from "@pig/ui/spinner"
</script>
