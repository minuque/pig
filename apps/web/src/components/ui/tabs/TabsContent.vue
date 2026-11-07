<template>
  <TabsContent data-slot="tabs-content" class="rt-TabsContent" v-bind="forwarded">
    <slot />
  </TabsContent>
</template>

<script setup lang="ts">
import type { TabsContentProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { TabsContent, useForwardProps } from "reka-ui"

const props = defineProps<TabsContentProps>()
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardProps(props) as ComputedRef<TabsContentProps>
</script>
