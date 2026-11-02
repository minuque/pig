<template>
  <DropdownMenuPortal>
    <ThemeRoot>
      <DropdownMenuSubContent
        data-slot="dropdown-menu-sub-content"
        v-bind="forwardedProps"
        :data-accent-color="accentColor"
        :align-offset="alignOffset"
        :side-offset="1"
        :collision-padding="10"
        class="rt-PopperContent rt-BaseMenuContent rt-BaseMenuSubContent rt-DropdownMenuContent rt-DropdownMenuSubContent"
        :class="[sizeClass, variantClass, highContrastClass, props.class]"
      >
        <div class="rt-BaseMenuViewport rt-DropdownMenuViewport">
          <slot />
        </div>
      </DropdownMenuSubContent>
    </ThemeRoot>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import type { DropdownMenuSubContentProps } from "reka-ui"
import { computed, type ComputedRef, type HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuPortal, DropdownMenuSubContent, useForwardProps } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { RT_SIZE, sizeClass as rtSizeClass } from "@components/ui/rt/size.js"
import { useMenuContent } from "@components/ui/rt/menu-context.js"

const props = withDefaults(
  defineProps<DropdownMenuSubContentProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const menu = useMenuContent()
const size = computed(() => menu?.size.value ?? "m")
const variant = computed(() => menu?.variant.value ?? "solid")
const accentColor = computed(() => menu?.color.value)
const highContrastClass = computed(() =>
  menu?.highContrast.value ? "rt-high-contrast" : undefined,
)
const sizeClass = computed(() => rtSizeClass(size.value))
const variantClass = computed(() => `rt-variant-${variant.value}`)
const alignOffset = computed(() => -Number(RT_SIZE[size.value]) * 4)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuSubContentProps>
</script>
