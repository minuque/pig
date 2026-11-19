<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    :data-variant="variant"
    :class="variant === 'segmented' ? 'rt-reset' : 'rt-reset rt-BaseTabListTrigger rt-TabsTrigger'"
    :value="value"
    :disabled="disabled"
  >
    <slot v-if="variant === 'segmented'" />

    <template v-else>
      <span class="rt-BaseTabListTriggerInner rt-TabsTriggerInner"><slot /></span>
      <!-- rt 用隐藏的加粗副本占位，切换选中时宽度不跳 -->
      <span class="rt-BaseTabListTriggerInnerHidden rt-TabsTriggerInnerHidden"><slot /></span>
    </template>
  </TabsTrigger>
</template>

<script setup lang="ts">
import { inject, ref } from "vue"
import { TabsTrigger } from "reka-ui"
import { TABS_VARIANT } from "./context.js"

defineProps<{ value: string | number; disabled?: boolean }>()

const variant = inject(TABS_VARIANT, ref("underline"))
</script>

<style scoped>
[data-variant="segmented"] {
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

[data-size="s"] > [data-variant="segmented"] {
  padding-inline: var(--space-xs);
  border-radius: calc(var(--radius-control) - 2px);
}

[data-variant="segmented"]:is([data-state="active"], :not([data-disabled]):hover) {
  color: var(--fg);
}

[data-variant="segmented"][data-disabled] {
  color: var(--fg-faint);
  cursor: not-allowed;
}

[data-variant="segmented"]:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
