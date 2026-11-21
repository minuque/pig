<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...forwarded, ...(reference && { reference }) }"
      :data-tone="props.color"
      data-menu-content
      :data-size="size"
      :class="['reveal-menu', props.class]"
    >
      <div v-if="!bare" data-menu-viewport>
        <slot />
      </div>

      <slot v-else />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from "reka-ui"
import { computed, type ComputedRef, type HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from "reka-ui"
import type { MenuSize, ToneColor } from "@/types/ui-type.js"
import { usePopperAnchor } from "./popper-anchor.js"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DropdownMenuContentProps & {
      class?: HTMLAttributes["class"]
      bare?: boolean
      size?: MenuSize
      color?: ToneColor
    }
  >(),
  {
    class: undefined,
    align: "start",
    sideOffset: 4,
    collisionPadding: 10,
    bare: false,
    size: "m",
  },
)
const emits = defineEmits<DropdownMenuContentEmits>()
// 外部：被 Tooltip 包住时 MenuAnchor 会注册到 Tooltip 的 PopperRoot，须显式传触发元素当锚点
const anchor = usePopperAnchor()
const reference = computed(() => props.reference ?? anchor?.value)
const delegatedProps = reactiveOmit(props, "class", "bare", "size", "color")
// 外部：reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，须 cast 到组件 props 类型
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<DropdownMenuContentProps>
</script>
