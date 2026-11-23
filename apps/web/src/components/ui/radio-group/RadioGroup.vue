<template>
  <RadioGroupRoot
    data-radio-group
    v-bind="modelValue === undefined ? {} : { value: modelValue }"
    :disabled="disabled"
    :class="props.class"
    @value-change="(next: string | null) => next !== null && emit('update:modelValue', next)"
  >
    <slot />
  </RadioGroupRoot>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, provide } from "vue"
import { RadioGroup as RadioGroupRoot } from "@ui-sdk/vue/radio"
import type { Size, ToneColor } from "@/types/ui-type.js"
import { RADIO_GROUP_KEY } from "./type.js"

const props = withDefaults(
  defineProps<{
    modelValue?: string | undefined
    disabled?: boolean
    class?: HTMLAttributes["class"]
    size?: Size
    variant?: "surface" | "soft"
    color?: ToneColor
  }>(),
  {
    modelValue: undefined,
    disabled: false,
    class: undefined,
    size: "m",
    variant: "surface",
  },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()

provide(
  RADIO_GROUP_KEY,
  computed(() => ({
    size: props.size,
    variant: props.variant,
    color: props.color,
  })),
)
</script>

<style>
:where([data-radio-group]) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}
</style>
