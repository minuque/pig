<template>
  <TabsRoot data-slot="tabs" class="rt-TabsRoot" v-bind="forwarded">
    <slot />
  </TabsRoot>
</template>

<script setup lang="ts">
import type { TabsRootEmits, TabsRootProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { TabsRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<TabsRootProps>()
const emits = defineEmits<TabsRootEmits>()
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(props, emits) as ComputedRef<TabsRootProps>
</script>
