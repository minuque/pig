<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    class="card-row"
    :data-bleed="bleed || interactive || undefined"
    :data-interactive="interactive || undefined"
  >
    <slot />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import { Primitive } from "reka-ui"

withDefaults(
  defineProps<
    PrimitiveProps & {
      /** 行贴到卡片两侧、不带左右内边距，行里的内容自己读 --card-padding；行线随之贴边 */
      bleed?: boolean
      /** 可点的整行：贴边，左右内边距取 --card-padding，带悬停底 */
      interactive?: boolean
    }
  >(),
  { as: "div", asChild: false, bleed: false, interactive: false },
)
</script>
