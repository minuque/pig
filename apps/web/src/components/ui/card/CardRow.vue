<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    class="card-row"
    :data-bleed="bleed || undefined"
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
      /** 行不带左右内边距，行里的内容自己读 --card-padding */
      bleed?: boolean
      /** 可点的整行：带悬停底 */
      interactive?: boolean
    }
  >(),
  { as: "div", asChild: false, bleed: false, interactive: false },
)
</script>

<style>
.card-row {
  padding-inline: var(--card-padding);
}

.card-row[data-bleed] {
  padding-inline: 0;
}

.card-row + .card-row {
  box-shadow: var(--separator-top);
}

.card-row[data-interactive] {
  transition: background-color var(--duration-fast) var(--ease-out);
}

.card-row[data-interactive]:hover {
  background-color: var(--bg-hover);
}
</style>
