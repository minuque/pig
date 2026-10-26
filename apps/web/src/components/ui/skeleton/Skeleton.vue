<template>
  <Primitive
    v-if="loading"
    data-slot="skeleton"
    :as="as"
    :as-child="asChild"
    aria-hidden="true"
    tabindex="-1"
    :data-inline-skeleton="asChild ? undefined : true"
    class="rt-Skeleton"
    :class="props.class"
    :style="skeletonStyle"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>

  <slot v-else />
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Primitive } from "reka-ui"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    Pick<PrimitiveProps, "as" | "asChild"> & {
      /** false 时直接渲染内容，rt 用它包住真实内容做加载占位 */
      loading?: boolean
      /** 骨架尺寸；不传时按内容撑开 */
      width?: string
      height?: string
      class?: HTMLAttributes["class"]
    }
  >(),
  { as: "span", asChild: false, loading: true, class: undefined },
)
const skeletonStyle = computed(() => ({
  inlineSize: props.width,
  blockSize: props.height,
}))
</script>
