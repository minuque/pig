<template>
  <Primitive
    data-slot="badge"
    :data-size="size"
    :data-variant="variant"
    :data-accent-color="color"
    :data-radius="radius"
    :as="as"
    :as-child="asChild"
    :class="props.class"
    v-bind="$attrs"
  >
    <slot />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import type { Radius } from "@components/ui/button/index.js"
import type { Size } from "@/types/ui-type.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    Pick<PrimitiveProps, "as" | "asChild"> & {
      /** 尺寸档：s、m、l */
      size?: Size
      variant?: "solid" | "soft" | "surface" | "outline"
      color?: string
      radius?: Radius
      class?: HTMLAttributes["class"]
    }
  >(),
  {
    as: "span",
    asChild: false,
    size: "s",
    variant: "soft",
    class: undefined,
  },
)
</script>

<style>
:where([data-slot="badge"]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: fit-content;
  border: 0;
  font-family: var(--font-sans);
  font-style: normal;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

:where([data-slot="badge"][data-size="s"]) {
  padding: calc(var(--space-2xs) * 0.5) calc(var(--space-2xs) * 1.5);
  border-radius: calc(var(--radius-control) / 2);
  gap: calc(var(--space-2xs) * 1.5);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="badge"][data-size="m"]) {
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  gap: calc(var(--space-2xs) * 1.5);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="badge"][data-size="l"]) {
  padding: var(--space-2xs) calc(var(--space-xs) * 1.25);
  border-radius: var(--radius-control);
  gap: var(--space-xs);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="badge"][data-radius="none"]) {
  border-radius: 0;
}

:where([data-slot="badge"][data-radius="small"]) {
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="badge"][data-radius="medium"]) {
  border-radius: var(--radius-control);
}

:where([data-slot="badge"][data-radius="large"]) {
  border-radius: var(--radius-card);
}

:where([data-slot="badge"][data-radius="full"]) {
  border-radius: var(--radius-pill);
}

:where([data-slot="badge"][data-variant="solid"]) {
  background-color: var(--accent-9);
  color: var(--accent-contrast);
}

:where([data-slot="badge"][data-variant="soft"]) {
  background-color: var(--accent-a3);
  color: var(--accent-a11);
}

:where([data-slot="badge"][data-variant="surface"]) {
  background-color: var(--accent-a2);
  box-shadow: inset 0 0 0 var(--border-width) var(--accent-a6);
  color: var(--accent-a11);
}

:where([data-slot="badge"][data-variant="outline"]) {
  background-color: transparent;
  box-shadow: inset 0 0 0 var(--border-width) var(--accent-a8);
  color: var(--accent-a11);
}
</style>
