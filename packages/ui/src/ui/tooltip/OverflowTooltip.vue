<template>
  <span :ref="bindHost" v-bind="triggerAttrs()">
    <slot>{{ text }}</slot>

    <TooltipContent :side="side" :container="portal">
      <template v-if="mounted">{{ content ?? text }}</template>
    </TooltipContent>
  </span>
</template>

<script setup lang="ts">
import { ref, useAttrs, useId, type ComponentPublicInstance } from "vue"
import type { ChangeDetails, Primitive, Side } from "@ui-sdk/core"
import { tooltip, type TooltipOpenChangeReason } from "@ui-sdk/core/tooltip"
import { usePrimitive } from "@ui-sdk/vue/primitive"
import TooltipContent from "./TooltipContent.vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    text?: string
    content?: string | undefined
    side?: Side
    always?: boolean
  }>(),
  {
    text: "",
    side: "top",
    always: false,
  },
)
const attrs = useAttrs()
const triggerId = useId()
const host = ref<HTMLElement | null>(null)
const mounted = ref(false)
const portal = typeof document !== "undefined" ? document.body : undefined
let slotRef: ((el: Element | ComponentPublicInstance | null) => void) | undefined
const handle = usePrimitive(tooltip as unknown as Primitive, () => ({
  delay: 400,
  type: "description",
  onOpenChange(open: boolean, details: ChangeDetails<TooltipOpenChangeReason>) {
    const el = host.value

    if (open && !props.always && !(el && el.scrollWidth > el.clientWidth + 1)) {
      details.cancel()
      return
    }

    if (open) mounted.value = true
  },
  onOpenChangeComplete(open: boolean) {
    mounted.value = open
  },
}))

function triggerAttrs(): Record<string, unknown> {
  const { type: _type, ref: partRef, ...rest } = handle.slot("trigger", { id: triggerId }, attrs)
  slotRef = typeof partRef === "function" ? partRef : undefined
  return rest
}

function bindHost(el: Element | ComponentPublicInstance | null) {
  host.value = el instanceof HTMLElement ? el : null
  slotRef?.(el)
}
</script>
