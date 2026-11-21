<template>
  <TabsContent data-slot="tabs-content" v-bind="forwarded">
    <slot />
  </TabsContent>
</template>

<script setup lang="ts">
import type { TabsContentProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { TabsContent, useForwardProps } from "reka-ui"

const props = defineProps<TabsContentProps>()
// 外部：reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，须 cast 到组件 props 类型
const forwarded = useForwardProps(props) as ComputedRef<TabsContentProps>
</script>

<style>
:where([data-slot="tabs-content"]) {
  position: relative;
  outline: 0;
}

:where([data-slot="tabs-content"]:focus-visible) {
  outline: 2px solid var(--focus-color);
}
</style>
