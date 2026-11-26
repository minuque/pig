<template>
  <ButtonPrimitive
    v-bind="{ ...$attrs, ...(props.onClick && { onClick: chainClick(props.onClick) }) }"
    data-button
    :data-size="size"
    :data-variant="variant"
    :data-tone="tone"
    :data-radius="radius"
    :data-loading="loading || undefined"
    :disabled="disabled || loading"
    :class="props.class"
  >
    <template v-if="$slots.render" #render="part">
      <slot name="render" v-bind="part" />
    </template>

    <template v-else #default>
      <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
      <slot name="suffix" />
    </template>
  </ButtonPrimitive>
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue"
import { Button as ButtonPrimitive } from "@ui-sdk/vue/button"
import type { Size, ToneColor, Radius } from "../../core/types.js"
import type { ButtonVariant } from "./index.js"
import ButtonContent from "./ButtonContent.vue"
import { chainClick } from "./press.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: Size
    color?: ToneColor
    radius?: Radius
    loading?: boolean
    disabled?: boolean
    class?: HTMLAttributes["class"]
    onClick?: Parameters<typeof chainClick>[0]
  }>(),
  {
    variant: "solid",
    size: "m",
    loading: false,
    disabled: false,
    class: undefined,
  },
)
const tone = computed(() => props.color ?? (props.variant === "solid" ? "accent" : "neutral"))
</script>

<style>
:where([data-button]) {
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  appearance: none;
  padding: 0;
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-control);
  background-color: transparent;
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-style: normal;
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

:where([data-button]:active:not([aria-haspopup], [data-disabled])) {
  transform: scale(0.97);
}

:where([data-button]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-button]:focus-visible[data-tone="danger"]) {
  outline-color: var(--danger-text);
}

:where([data-button][data-disabled]) {
  opacity: var(--opacity-disabled);
  pointer-events: none;
}

:where([data-button]:not([data-icon-button])[data-size="s"]) {
  height: var(--control-sm);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  gap: calc(var(--spacing) * 1.5);
  padding-inline: calc(var(--spacing) * 2.5 - var(--border-width));
}

:where([data-button]:not([data-icon-button])[data-size="m"]) {
  height: var(--control-md);
  gap: var(--space-xs);
  padding-inline: calc(var(--spacing) * 3 - var(--border-width));
}

:where([data-button][data-variant="solid"]) {
  background-color: var(--tone);
  box-shadow:
    var(--button-highlight),
    0 1px 2px var(--tone-shadow);
  color: var(--tone-on-solid);
}

@media (hover: hover) {
  :where([data-button][data-variant="solid"]:hover) {
    background-color: var(--tone-hover);
  }
}

:where([data-button][data-variant="solid"][data-open]) {
  background-color: var(--tone-hover);
}

:where([data-button][data-variant="solid"]:active) {
  box-shadow: var(--button-pressed);
}

:where([data-button][data-variant="secondary"]) {
  background-color: var(--bg-muted);
}

:where([data-button][data-variant="outline"]) {
  border-color: var(--outline-ring);
  background-clip: padding-box;
  box-shadow: var(--control-shadow);
}

:where([data-button][data-variant="outline"]:active) {
  box-shadow: none;
}

@media (hover: hover) {
  :where([data-button]:is([data-variant="secondary"], [data-variant="outline"]):hover) {
    background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  }
}

:where([data-button]:is([data-variant="secondary"], [data-variant="outline"])[data-open]) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
}

@media (hover: hover) {
  :where([data-button][data-variant="ghost"]:hover) {
    background-color: var(--bg-hover);
  }
}

:where([data-button][data-variant="ghost"][data-open]) {
  background-color: var(--bg-hover);
}

:where(
    [data-button]:is([data-variant="outline"], [data-variant="ghost"]):is(
        :not([data-tone]),
        [data-tone="neutral"]
      )
  )
  :where(svg) {
  color: var(--fg-muted);
}

:where(
    [data-button]:is([data-variant="outline"], [data-variant="ghost"]):is(
        [data-open],
        [data-active],
        [aria-pressed="true"],
        [aria-expanded="true"]
      )
  )
  :where(svg) {
  color: inherit;
}

@media (hover: hover) {
  :where([data-button]:is([data-variant="outline"], [data-variant="ghost"]):hover) :where(svg) {
    color: inherit;
  }
}

:where([data-button][data-tone]:not([data-tone="neutral"], [data-variant="solid"])) {
  color: var(--tone-text);
}

@media (prefers-reduced-motion: reduce) {
  :where([data-button]) {
    transition: none;
  }

  :where([data-button]:active:not([aria-haspopup], [data-disabled])) {
    transform: none;
  }
}
</style>
