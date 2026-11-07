<template>
  <TabsTrigger
    data-slot="tabs-trigger"
    class="rt-reset rt-BaseTabListTrigger rt-TabsTrigger"
    :value="value"
    :disabled="disabled"
  >
    <span class="rt-BaseTabListTriggerInner rt-TabsTriggerInner"><slot /></span>
    <!-- rt 用隐藏的加粗副本占位，切换选中时宽度不跳 -->
    <span class="rt-BaseTabListTriggerInnerHidden rt-TabsTriggerInnerHidden"><slot /></span>
  </TabsTrigger>
</template>

<script setup lang="ts">
import { TabsTrigger } from "reka-ui"

defineProps<{ value: string | number; disabled?: boolean }>()
</script>
