<template>
  <Story title="Spinner">
    <Variant title="Sizes">
      <div style="display: flex; align-items: center; gap: 16px">
        <Spinner :size="12" label="Small loading" />
        <Spinner :size="16" label="Medium loading" />
        <Spinner :size="20" label="Large loading" />
      </div>
    </Variant>

    <Variant title="Colors">
      <div style="display: flex; align-items: center; gap: 16px">
        <Spinner :size="20" label="Default loading" />
        <Spinner :size="20" label="Indigo loading" style="color: var(--accent-9)" />
        <Spinner :size="20" label="Red loading" style="color: var(--red-9)" />
      </div>
    </Variant>
  </Story>
</template>

<script setup lang="ts">
import Story from "@features/design-lab/components/DemoStory.vue"
import Variant from "@features/design-lab/components/DemoVariant.vue"
import { Spinner } from "@components/ui/spinner/index.js"
</script>
