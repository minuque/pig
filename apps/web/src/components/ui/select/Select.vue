<template>
  <SelectRoot v-bind="$attrs">
    <slot />
  </SelectRoot>
</template>

<script setup lang="ts">
import { toRef } from "vue"
import { Select as SelectRoot } from "@ui-sdk/vue/select"
import type { Size } from "@/types/ui-type.js"
import { provideSelectSize } from "@components/ui/select/select-context.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ size?: Size }>(), { size: "m" })

provideSelectSize(toRef(props, "size"))
</script>
