<template>
  <!-- 有内容时按 rt 的结构渲染成 label：按钮空着，文字进内层 span -->
  <label
    v-if="$slots.default"
    class="rt-Text rt-RadioGroupItem"
    :class="[textSizeClass, props.class]"
  >
    <RadioGroupItem
      data-slot="radio-group-item"
      v-bind="forwardedProps"
      class="rt-reset rt-BaseRadioRoot"
      :class="[sizeClass, variantClass]"
    />

    <span class="rt-RadioGroupItemInner"><slot /></span>
  </label>

  <RadioGroupItem
    v-else
    data-slot="radio-group-item"
    v-bind="forwardedProps"
    class="rt-reset rt-BaseRadioRoot"
    :class="[sizeClass, variantClass, props.class]"
  />
</template>

<script setup lang="ts">
import type { RadioGroupItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, inject } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupItem, useForwardProps } from "reka-ui"
import { sizeClass as rtSizeClass } from "@components/ui/rt/size.js"
import { RADIO_GROUP_KEY } from "./context.js"

const props = withDefaults(
  defineProps<RadioGroupItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<RadioGroupItemProps>
const group = inject(
  RADIO_GROUP_KEY,
  computed(() => ({ size: "m", variant: "surface" }) as const),
)
const sizeClass = computed(() => rtSizeClass(group.value.size))
// 文字尺寸与单选按钮同档：rt 用 <Text size> 包 label，行高决定圆点外边距
const textSizeClass = computed(() => rtSizeClass(group.value.size))
const variantClass = computed(() => `rt-variant-${group.value.variant}`)
</script>
