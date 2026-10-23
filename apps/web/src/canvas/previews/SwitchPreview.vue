<template>
  <Switch v-model="on" :disabled="disabled" />
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import { Switch } from "@components/ui/switch/index.js"

const props = withDefaults(defineProps<{ initial?: boolean; disabled?: boolean }>(), {
  initial: false,
  disabled: false,
})
const on = shallowRef(props.initial)
</script>
