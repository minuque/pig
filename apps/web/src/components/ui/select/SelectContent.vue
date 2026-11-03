<template>
  <SelectPortal>
    <ThemeRoot>
      <SelectContent
        data-slot="select-content"
        :data-accent-color="color"
        :position="position"
        :side-offset="4"
        :collision-padding="10"
        v-bind="forwarded"
        class="rt-SelectContent"
        :class="[
          sizeClass,
          variantClass,
          position === 'popper' && 'rt-PopperContent',
          highContrast && 'rt-high-contrast',
          props.class,
        ]"
      >
        <SelectViewport class="rt-SelectViewport">
          <slot />
        </SelectViewport>
      </SelectContent>
    </ThemeRoot>
  </SelectPortal>
</template>

<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectContent, SelectPortal, SelectViewport, useForwardPropsEmits } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { sizeClass as rtSizeClass } from "@components/ui/rt/size.js"
import { useSelectSize } from "@components/ui/select/select-context.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    SelectContentProps & {
      class?: HTMLAttributes["class"]
      variant?: "solid" | "soft"
      color?: string
      highContrast?: boolean
    }
  >(),
  { class: undefined, variant: "solid", position: "popper", highContrast: false },
)
const emits = defineEmits<SelectContentEmits>()
const delegatedProps = reactiveOmit(props, "class", "variant", "color", "highContrast", "position")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<SelectContentProps>
const size = useSelectSize()
const sizeClass = computed(() => rtSizeClass(size.value))
const variantClass = computed(() => `rt-variant-${props.variant}`)
</script>
