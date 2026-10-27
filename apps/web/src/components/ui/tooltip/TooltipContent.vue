<template>
  <TooltipPortal>
    <ThemeRoot>
      <TooltipContent
        data-slot="tooltip-content"
        v-bind="{ ...$attrs, ...forwarded }"
        class="rt-TooltipContent"
        :class="props.class"
      >
        <p class="rt-Text rt-TooltipText rt-r-size-1">
          <slot />
        </p>

        <TooltipArrow class="rt-TooltipArrow" />
      </TooltipContent>
    </ThemeRoot>
  </TooltipPortal>
</template>

<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipArrow, TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const emits = defineEmits<TooltipContentEmits>()
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<TooltipContentProps>
</script>
