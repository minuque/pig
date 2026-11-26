<template>
  <RadioGroupRoot
    data-radio-cards
    :data-tone="color ?? 'accent'"
    :data-size="size"
    :data-variant="variant"
    v-bind="modelValue === undefined ? {} : { value: modelValue }"
    :disabled="disabled"
    :class="props.class"
    :style="gridStyle"
    @value-change="(next: string | null) => next !== null && emit('update:modelValue', next)"
  >
    <slot />
  </RadioGroupRoot>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { RadioGroup as RadioGroupRoot } from "@ui-sdk/vue/radio"
import type { Size, ToneColor } from "../../core/types.js"

const props = withDefaults(
  defineProps<{
    modelValue?: string | undefined
    disabled?: boolean
    class?: HTMLAttributes["class"]
    size?: Size
    variant?: "surface"
    color?: ToneColor
    columns?: string
    gap?: "2xs" | "xs" | "sm" | "md" | "lg"
  }>(),
  {
    modelValue: undefined,
    disabled: false,
    class: undefined,
    size: "m",
    variant: "surface",
    columns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "sm",
  },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const gridStyle = computed(() => ({
  gridTemplateColumns: props.columns,
  gap: `var(--space-${props.gap})`,
}))
</script>

<style>
:where([data-radio-cards]) {
  display: grid;
  cursor: default;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}
</style>
