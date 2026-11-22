<template>
  <MenuTrigger>
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps">
        <slot />
      </AsChildSlot>
    </template>

    <template v-else #default>
      <slot />
    </template>
  </MenuTrigger>
</template>

<script setup lang="ts">
import { MenuTrigger } from "@ui-sdk/vue/menu"
import { AsChildSlot } from "@components/ui/primitive/index.js"

defineProps<{ asChild?: boolean }>()
</script>
