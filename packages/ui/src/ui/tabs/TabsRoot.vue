<template>
  <TabsRoot
    v-bind="valueProps"
    :activation="activationMode"
    @update:value="(next: string | null) => next !== null && emit('update:modelValue', next)"
  >
    <slot />
  </TabsRoot>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Tabs as TabsRoot } from "@ui-sdk/vue/tabs"

const props = withDefaults(
  defineProps<{
    modelValue?: string | undefined
    defaultValue?: string | undefined
    activationMode?: "automatic" | "manual"
  }>(),
  { modelValue: undefined, defaultValue: undefined, activationMode: "automatic" },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const valueProps = computed(() => ({
  ...(props.modelValue === undefined ? {} : { value: props.modelValue }),
  ...(props.defaultValue === undefined ? {} : { defaultValue: props.defaultValue }),
}))
</script>
