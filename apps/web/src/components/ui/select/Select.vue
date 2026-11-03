<template>
  <SelectRoot v-bind="$attrs">
    <slot />
  </SelectRoot>
</template>

<script setup lang="ts">
import { toRef } from "vue"
import { SelectRoot } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"
import { provideSelectSize } from "@components/ui/select/select-context.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ size?: Size }>(), { size: "m" })

provideSelectSize(toRef(props, "size"))
</script>
