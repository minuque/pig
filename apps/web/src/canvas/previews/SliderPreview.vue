<template>
  <Slider v-model="value" class="w-full" :min="0" :max="100" :disabled="disabled" />
</template>

<script setup lang="ts">
import { shallowRef } from "vue"
import { Slider } from "@components/ui/slider/index.js"

const props = withDefaults(defineProps<{ initial?: number; disabled?: boolean }>(), {
  initial: 40,
  disabled: false,
})
const value = shallowRef([props.initial])
</script>
