<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      data-slot="dropdown-menu-content"
      v-bind="{ ...$attrs, ...forwarded, ...(reference && { reference }) }"
      :data-accent-color="props.color"
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
import type { MenuSize } from "@/types/ui-type.js"
import { usePopperAnchor } from "./popper-anchor.js"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DropdownMenuContentProps & {
      class?: HTMLAttributes["class"]
      /** 大面板自管内边距，不套菜单视口壳 */
      bare?: boolean
      /** 菜单尺寸：s 紧凑、m 默认 */
      size?: MenuSize
      color?: string
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
// 被 Tooltip 包住时 MenuAnchor 会注册到 Tooltip 的 PopperRoot，须显式传触发元素当锚点
const anchor = usePopperAnchor()
const reference = computed(() => props.reference ?? anchor?.value)
const delegatedProps = reactiveOmit(props, "class", "bare", "size", "color")
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<DropdownMenuContentProps>
</script>
