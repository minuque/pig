<template>
  <div
    data-slot="text-field-root"
    :data-accent-color="color"
    :data-radius="radius"
    :class="['rt-TextFieldRoot', extracted.class, props.class]"
    :style="extracted.style"
    @pointer-down="onPointerDown"
  >
    <input
      ref="inputRef"
      spellcheck="false"
      class="rt-reset rt-TextFieldInput"
      :value="modelValue"
      v-bind="{ ...extracted.attrs, ...$attrs }"
      @input="onInput"
    />

    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, ref } from "vue"
import { extractProps, type PropDefs } from "@components/ui/rt/props.js"
import type { Radius } from "@components/ui/button/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    /** Radix Themes 的输入框尺寸：1、2、3 */
    size?: "1" | "2" | "3"
    variant?: "classic" | "surface" | "soft"
    color?: string
    radius?: Radius
    class?: HTMLAttributes["class"]
  }>(),
  { size: "2", variant: "surface", class: undefined },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const DEFS: PropDefs = {
  size: { type: "enum", values: ["1", "2", "3"], default: "2", className: "rt-r-size" },
  variant: {
    type: "enum",
    values: ["classic", "surface", "soft"],
    default: "surface",
    className: "rt-variant",
  },
}
const extracted = computed(() => extractProps(props as Record<string, unknown>, DEFS))
const inputRef = ref<HTMLInputElement>()

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value)
}

/**
 * 点根容器（含左右插槽）也要聚焦输入框，光标落在靠近的那一端。
 * 选择器与 rt 一致：右侧槽（含未标 side 的槽）当右端处理。
 */
function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement

  if (target.closest("input, button, a")) return

  const input = inputRef.value

  if (!input) return

  const isRightSlot = target.closest(
    ".rt-TextFieldSlot[data-side='right'], .rt-TextFieldSlot:not([data-side='right']) ~ .rt-TextFieldSlot:not([data-side='left'])",
  )
  const caret = isRightSlot ? input.value.length : 0

  requestAnimationFrame(() => {
    try {
      input.setSelectionRange(caret, caret)
    } catch {
      // 部分 input type 不支持 setSelectionRange
    }

    input.focus()
  })
}
</script>
