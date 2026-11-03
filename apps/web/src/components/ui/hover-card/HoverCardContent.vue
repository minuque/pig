<template>
  <HoverCardPortal>
    <ThemeRoot>
      <HoverCardContent
        data-slot="hover-card-content"
        :align="align"
        :side-offset="8"
        :collision-padding="10"
        v-bind="forwarded"
        class="rt-PopperContent rt-HoverCardContent"
        :class="[sizeClass, props.class]"
        :style="widthStyle"
      >
        <slot />
      </HoverCardContent>
    </ThemeRoot>
  </HoverCardPortal>
</template>

<script setup lang="ts">
import type { HoverCardContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { HoverCardContent, HoverCardPortal, useForwardProps } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    HoverCardContentProps & {
      class?: HTMLAttributes["class"]
      /** 内边距档：s、m、l */
      size?: Size
      align?: "start" | "center" | "end"
      /** 面板最大宽度，默认沿用 rt 的 480px */
      maxWidth?: string
    }
  >(),
  { class: undefined, size: "m", align: "start", maxWidth: "480px" },
)
const delegatedProps = reactiveOmit(props, "class", "size", "align", "maxWidth")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<HoverCardContentProps>
const sizeClass = computed(() => rtSizeClass(props.size))
const widthStyle = computed(() => ({ maxInlineSize: props.maxWidth }))
</script>
