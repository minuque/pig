<template>
  <FieldPrimitive v-bind="$attrs">
    <slot />
  </FieldPrimitive>
</template>

<script setup lang="ts">
import { Field as FieldPrimitive } from "@ui-sdk/vue/field"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="field"]) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

:where([data-slot="field-label"]) {
  color: var(--fg);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="field"][data-disabled] [data-slot="field-label"]) {
  color: var(--fg-secondary);
}

:where([data-slot="field-description"]) {
  margin: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="field-error"]) {
  margin: 0;
  color: var(--danger-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}
</style>
