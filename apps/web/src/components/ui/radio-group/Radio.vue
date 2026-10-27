<template>
  <input
    type="radio"
    data-slot="radio"
    :data-accent-color="color"
    class="rt-reset rt-BaseRadioRoot rt-RadioRoot"
    :class="[sizeClass, variantClass, props.class]"
    :value="value"
    :name="name"
    :disabled="disabled"
    :checked="checked"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    /** 独立使用的单选按钮：脱离 RadioGroup 时用它自己成组（同名 group） */
    value: string
    name?: string
    checked?: boolean
    disabled?: boolean
    color?: string
    size?: "1" | "2" | "3"
    variant?: "classic" | "surface" | "soft"
    class?: HTMLAttributes["class"]
  }>(),
  { disabled: false, size: "2", variant: "surface", class: undefined },
)
const emit = defineEmits<{ "update:checked": [checked: boolean] }>()
const sizeClass = computed(() => `rt-r-size-${props.size}`)
const variantClass = computed(() => `rt-variant-${props.variant}`)

function onChange(event: Event) {
  emit("update:checked", (event.target as HTMLInputElement).checked)
}
</script>
