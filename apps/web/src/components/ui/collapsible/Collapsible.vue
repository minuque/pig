<template>
  <CollapsibleRoot
    v-bind="open === undefined ? {} : { open }"
    @update:open="(next: boolean) => emit('update:open', next)"
  >
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <slot />
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import { Collapsible as CollapsibleRoot } from "@ui-sdk/vue/collapsible"
import { AsChildSlot } from "@components/ui/primitive/index.js"

withDefaults(
  defineProps<{
    open?: boolean | undefined
    asChild?: boolean
  }>(),
  { open: undefined, asChild: false },
)

const emit = defineEmits<{ "update:open": [open: boolean] }>()
</script>
