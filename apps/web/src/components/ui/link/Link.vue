<template>
  <Polymorphic
    v-bind="$attrs"
    data-slot="link"
    :as="as"
    :as-child="asChild"
    :data-size="size"
    :data-underline="underline"
    :data-underline-style="underlineStyle"
    :data-tone="color"
    :class="[weightClass, truncate && 'truncate', props.class]"
  >
    <slot />
  </Polymorphic>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { Polymorphic, type PolymorphicProps } from "@components/ui/primitive/index.js"
import type { Size, ToneColor } from "@/types/ui-type.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PolymorphicProps & {
      class?: HTMLAttributes["class"]
      size?: Size
      weight?: "regular" | "medium" | "bold"
      underline?: "auto" | "always" | "hover" | "none"
      underlineStyle?: "solid" | "dotted"
      color?: ToneColor
      truncate?: boolean
    }
  >(),
  {
    as: "a",
    asChild: false,
    underline: "auto",
    underlineStyle: "solid",
    truncate: false,
    class: undefined,
  },
)
const WEIGHT_CLASS = { regular: "font-normal", medium: "font-medium", bold: "font-bold" } as const
const weightClass = computed(() => (props.weight ? WEIGHT_CLASS[props.weight] : undefined))
</script>

<style>
:where([data-slot="link"]) {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  line-height: inherit;
  text-align: inherit;
  color: var(--link);
  text-decoration-line: none;
  text-decoration-style: solid;
  text-decoration-thickness: min(2px, max(1px, 0.05em));
  text-underline-offset: calc(0.025em + 2px);
  text-decoration-color: currentColor;
}

:where([data-slot="link"][data-size="s"]) {
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="link"][data-size="m"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="link"][data-size="l"]) {
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

:where([data-slot="link"]:is(:any-link, button)) {
  cursor: pointer;
}

:where([data-slot="link"]:is(:disabled, [data-disabled])) {
  cursor: default;
}

:where([data-slot="link"][data-tone]) {
  color: var(--tone-text);
}

:where([data-slot="link"][data-underline="always"]) {
  text-decoration-line: underline;
}

@media (hover: hover) {
  :where(
    [data-slot="link"]:is(:any-link, button):is(
        [data-underline="auto"],
        [data-underline="hover"]
      ):hover
  ) {
    text-decoration-line: underline;
  }

  :where([data-slot="link"][data-underline-style="dotted"]:is(:any-link, button):hover) {
    text-decoration-line: none;
    background-image: radial-gradient(circle, currentColor 0.75px, transparent 1px);
    background-position: left bottom;
    background-repeat: repeat-x;
    background-size: 4px 2px;
  }
}

:where([data-slot="link"]:focus-visible) {
  text-decoration-line: none;
  border-radius: calc(var(--radius-control) / 3);
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
</style>
