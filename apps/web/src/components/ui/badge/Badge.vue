<template>
  <Primitive
    data-slot="badge"
    :data-accent-color="color"
    :data-radius="radius"
    :as="as"
    :as-child="asChild"
    class="rt-reset rt-Badge"
    :class="[sizeClass, variantClass, highContrast && 'rt-high-contrast', props.class]"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"
import type { Radius } from "@components/ui/button/index.js"
import { sizeClass as rtSizeClass, type Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    Pick<PrimitiveProps, "as" | "asChild"> & {
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "solid" | "soft" | "surface" | "outline"
      color?: string
      radius?: Radius
      highContrast?: boolean
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    as: "span",
    asChild: false,
    size: "s",
    variant: "soft",
    radius: "small",
    highContrast: false,
    class: undefined,
  },
)
const sizeClass = computed(() => rtSizeClass(props.size))
const variantClass = computed(() => `rt-variant-${props.variant}`)
</script>

<style scoped>
/* rt 的 badge 只给胶囊：按 data-radius 接回项目的半径刻度 */
.rt-Badge[data-radius="none"] {
  border-radius: 0;
}

.rt-Badge[data-radius="small"] {
  border-radius: var(--radius-sm);
}

.rt-Badge[data-radius="medium"] {
  border-radius: var(--radius-md);
}

.rt-Badge[data-radius="large"] {
  border-radius: var(--radius-lg);
}

.rt-Badge[data-radius="full"] {
  border-radius: var(--radius-pill);
}
</style>
