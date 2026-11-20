<template>
  <Primitive
    data-slot="link"
    :as="as"
    :as-child="asChild"
    :data-size="size"
    :data-underline="underline"
    :data-accent-color="color"
    :class="[weightClass, truncate && 'truncate', props.class]"
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
import type { Size } from "@components/ui/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PrimitiveProps & {
      class?: HTMLAttributes["class"]
      /** 字号档：s、m、l；不传跟父级字号走（正文内链不会跳出字号） */
      size?: Size
      weight?: "regular" | "medium" | "bold"
      /** auto 只在 hover 时出下划线；always 常驻；none 不出 */
      underline?: "auto" | "always" | "hover" | "none"
      /** accent 色：不传取 --link */
      color?: string
      truncate?: boolean
    }
  >(),
  {
    as: "a",
    asChild: false,
    underline: "auto",
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

:where([data-slot="link"][data-accent-color]) {
  color: var(--accent-a11);
  text-decoration-color: var(--accent-a5);
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
}

:where([data-slot="link"]:focus-visible) {
  text-decoration-line: none;
  border-radius: calc(var(--radius-control) / 3);
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}
</style>
