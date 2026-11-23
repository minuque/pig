<template>
  <Polymorphic
    :as="as"
    :as-child="asChild"
    data-slot="card-row"
    :data-bleed="bleed || undefined"
    :data-interactive="interactive || undefined"
  >
    <slot />
  </Polymorphic>
</template>

<script setup lang="ts">
import { Polymorphic, type PolymorphicProps } from "../primitive/index.js"

withDefaults(
  defineProps<
    PolymorphicProps & {
      bleed?: boolean
      interactive?: boolean
    }
  >(),
  { as: "div", asChild: false, bleed: false, interactive: false },
)
</script>

<style>
:where([data-slot="card-row"]) {
  padding-inline: var(--card-padding);
}

:where([data-slot="card-row"][data-bleed]) {
  padding-inline: 0;
}

:where([data-slot="card-row"]) + :where([data-slot="card-row"]) {
  box-shadow: var(--separator-top);
}

:where([data-slot="card-row"][data-interactive]) {
  transition: background-color var(--duration-fast) var(--ease-out);
}

:where([data-slot="card-row"][data-interactive]:hover) {
  background-color: var(--bg-hover);
}
</style>
