<template>
  <PopoverPortal>
    <ThemeRoot>
      <PopoverContentPrimitive
        data-slot="popover-content"
        :side-offset="8"
        :collision-padding="10"
        v-bind="{ ...$attrs, ...forwarded }"
        class="rt-PopperContent rt-PopoverContent"
        :class="[sizeClass, props.class]"
        :style="{ maxInlineSize: props.maxWidth }"
      >
        <slot />
      </PopoverContentPrimitive>
    </ThemeRoot>
  </PopoverPortal>
</template>

<script setup lang="ts">
import type { PopoverContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { PopoverContent as PopoverContentPrimitive, PopoverPortal, useForwardProps } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PopoverContentProps & {
      class?: HTMLAttributes["class"]
      /** 内边距与圆角档：s、m、l */
      size?: Size
      /** 面板最大宽度，默认沿用 rt 的 480px */
      maxWidth?: string
    }
  >(),
  { class: undefined, size: "m", maxWidth: "480px" },
)
const delegatedProps = reactiveOmit(props, "class", "size", "maxWidth")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<PopoverContentProps>
const sizeClass = computed(() => rtSizeClass(props.size))
</script>
