<template>
  <Polymorphic
    :as="as"
    :as-child="asChild"
    class="card-row"
    :data-bleed="bleed || undefined"
    :data-interactive="interactive || undefined"
  >
    <slot />
  </Polymorphic>
</template>

<script setup lang="ts">
import { Polymorphic, type PolymorphicProps } from "@components/ui/primitive/index.js"

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
