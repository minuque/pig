<template>
  <DropdownMenuPortal>
    <ThemeRoot>
      <DropdownMenuContent
        data-slot="dropdown-menu-content"
        v-bind="{ ...$attrs, ...forwarded, ...(reference && { reference }) }"
        :data-accent-color="props.color"
        class="rt-PopperContent rt-BaseMenuContent rt-DropdownMenuContent"
        :class="[sizeClass, variantClass, highContrastClass, props.class]"
      >
        <div v-if="!bare" class="rt-BaseMenuViewport rt-DropdownMenuViewport">
          <slot />
        </div>

        <slot v-else />
      </DropdownMenuContent>
    </ThemeRoot>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from "reka-ui"
import { computed, toRef, type ComputedRef, type HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuContent, DropdownMenuPortal, useForwardPropsEmits } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"
import { provideMenuContent, type MenuVariant } from "@components/ui/rt/menu-context.js"
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
      /** Radix Themes 的菜单尺寸：s 紧凑、m 默认、l 宽松 */
      size?: Size
      variant?: MenuVariant
      color?: string
      highContrast?: boolean
    }
  >(),
  {
    class: undefined,
    align: "start",
    sideOffset: 4,
    collisionPadding: 10,
    bare: false,
    size: "m",
    variant: "solid",
    highContrast: false,
  },
)
const emits = defineEmits<DropdownMenuContentEmits>()
// 被 Tooltip 包住时 MenuAnchor 会注册到 Tooltip 的 PopperRoot，须显式传触发元素当锚点
const anchor = usePopperAnchor()
const reference = computed(() => props.reference ?? anchor?.value)
const delegatedProps = reactiveOmit(
  props,
  "class",
  "bare",
  "size",
  "variant",
  "color",
  "highContrast",
)
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<DropdownMenuContentProps>
const sizeClass = computed(() => rtSizeClass(props.size))
const variantClass = computed(() => `rt-variant-${props.variant}`)
const highContrastClass = computed(() => (props.highContrast ? "rt-high-contrast" : undefined))

provideMenuContent({
  size: toRef(props, "size"),
  variant: toRef(props, "variant"),
  color: toRef(props, "color"),
  highContrast: toRef(props, "highContrast"),
})
</script>
