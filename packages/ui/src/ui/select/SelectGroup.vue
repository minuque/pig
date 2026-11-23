<template>
  <SelectGroupPrimitive v-bind="$attrs">
    <slot />
  </SelectGroupPrimitive>
</template>

<script setup lang="ts">
import { SelectGroup as SelectGroupPrimitive } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })
</script>
