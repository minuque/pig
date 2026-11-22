<template>
  <MenuContextTrigger>
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps">
        <slot />
      </AsChildSlot>
    </template>

    <template v-else #default>
      <slot />
    </template>
  </MenuContextTrigger>
</template>

<script setup lang="ts">
import { MenuContextTrigger } from "@ui-sdk/vue/menu"
import { AsChildSlot } from "@components/ui/primitive/index.js"

defineProps<{ asChild?: boolean }>()
</script>
