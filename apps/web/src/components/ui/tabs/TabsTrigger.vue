<template>
  <TabsTab :data-variant="variant" :value="String(value)" :disabled="disabled">
    <slot v-if="variant === 'segmented'" />

    <template v-else>
      <span data-slot="tabs-trigger-inner"><slot /></span>
      <span data-slot="tabs-trigger-inner-hidden"><slot /></span>
    </template>
  </TabsTab>
</template>

<script setup lang="ts">
import { inject, ref } from "vue"
import { TabsTab } from "@ui-sdk/vue/tabs"
import { TABS_VARIANT } from "./context.js"

defineProps<{ value: string | number; disabled?: boolean }>()

const variant = inject(TABS_VARIANT, ref("underline"))
</script>

<style>
:where([data-slot="tabs-tab"][data-variant="segmented"]) {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  margin-block: 2px;
  padding-inline: calc(var(--spacing) * 2.5);
  border-radius: calc(var(--radius-card) - 2px);
  color: var(--fg-secondary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  cursor: pointer;
}

:where([data-slot="tabs-list"][data-size="s"] > [data-slot="tabs-tab"][data-variant="segmented"]) {
  padding-inline: var(--space-xs);
  border-radius: calc(var(--radius-control) - 2px);
}

:where(
  [data-slot="tabs-tab"][data-variant="segmented"]:is([data-selected], :not([data-disabled]):hover)
) {
  color: var(--fg);
}

:where([data-slot="tabs-tab"][data-variant="segmented"][data-disabled]) {
  color: var(--fg-secondary);
  cursor: not-allowed;
}

:where([data-slot="tabs-tab"][data-variant="segmented"]:focus-visible) {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
