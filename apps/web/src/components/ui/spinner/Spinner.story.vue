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
import { Spinner } from "./index.js"
</script>
