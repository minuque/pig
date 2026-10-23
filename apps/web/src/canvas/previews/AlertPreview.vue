<template>
  <Alert
    v-if="visible"
    class="w-full"
    :variant="variant"
    :dismissible="dismissible"
    @close="visible = false"
  >
    <template #icon><component :is="icon" /></template>
    <template #title>{{ title }}</template>
    {{ body }}
  </Alert>

  <Button v-else variant="outline" @click="visible = true">重新显示</Button>
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import type { Component } from "vue"
import {
  CheckCircleIcon,
  DangerCircleIcon,
  LightbulbMinimalisticIcon,
  QuestionCircleIcon,
} from "@components/icons/index.js"
import Alert from "@components/ui/alert/Alert.vue"
import { Button } from "@components/ui/button/index.js"

const props = withDefaults(
  defineProps<{
    variant?: "default" | "error" | "info" | "success" | "warning"
    dismissible?: boolean
    title?: string
    body?: string
  }>(),
  {
    variant: "default",
    dismissible: false,
    title: "标题",
    body: "这是一条示例提示，不会写入会话。",
  },
)
const visible = shallowRef(true)
const icons: Record<typeof props.variant, Component> = {
  default: LightbulbMinimalisticIcon,
  error: DangerCircleIcon,
  info: QuestionCircleIcon,
  success: CheckCircleIcon,
  warning: DangerCircleIcon,
}
const icon = icons[props.variant]
</script>
