<template>
  <Primitive
    data-button
    data-slot="button"
    :data-size="size"
    :data-variant="variant"
    :data-accent-color="color"
    :data-radius="radius"
    :data-high-contrast="highContrast || undefined"
    :data-disabled="disabled || loading ? '' : undefined"
    :data-loading="loading || undefined"
    :disabled="disabled || loading"
    :as="as"
    :as-child="asChild"
    :class="props.class"
    v-bind="$attrs"
  >
    <ButtonContent :loading="loading" :size="size"><slot /></ButtonContent>
    <slot name="suffix" />
  </Primitive>
</template>

<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Primitive } from "reka-ui"
import type { Size } from "@components/ui/rt/size.js"
import type { ButtonVariant, HighContrast, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

defineOptions({ inheritAttrs: false })

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: Size
  color?: string
  radius?: Radius
  highContrast?: HighContrast
  loading?: boolean
  disabled?: boolean
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
  asChild: false,
  variant: "solid",
  size: "m",
  loading: false,
  disabled: false,
  class: undefined,
})
</script>

<style>
/* 按钮：尺寸档 s/m/l 对应 24/32/40 的控件高，外观全在 data 属性上。
   底色与文字色读 rt 的色阶变量（`--accent-*`、`--gray-*`），换 accent 时整组跟随。 */
:where([data-button]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  appearance: none;
  height: var(--control-md);
  border-radius: var(--radius-control);
  padding: 0;
  font-family: var(--font-sans);
  font-style: normal;
  font-weight: var(--font-weight-normal);
  text-align: center;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
}

:where([data-button]:not([data-variant="ghost"])) {
  font-weight: var(--font-weight-medium);
}

:where([data-button]:not([data-variant="ghost"])) :where(svg) {
  opacity: 0.9;
}

:where([data-button][data-size="s"]) {
  height: var(--space-lg);
  gap: var(--space-2xs);
  padding-inline: var(--space-xs);
  border-radius: calc(var(--radius-control) / 2);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-button][data-size="m"]) {
  height: var(--control-md);
  gap: var(--space-xs);
  padding-inline: var(--space-sm);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-button][data-size="l"]) {
  height: var(--control-lg);
  gap: var(--space-sm);
  padding-inline: var(--space-md);
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

/* 幽灵按钮不占盒：内边距撑高，负外边距抵回视觉对齐（rt 的原样做法） */
:where([data-button][data-variant="ghost"]) {
  box-sizing: content-box;
  height: fit-content;
  padding-block: var(--space-2xs);
  padding-inline: var(--space-xs);
  margin: calc(var(--space-2xs) * -1);
  color: var(--accent-a11);
}

:where([data-button][data-variant="ghost"][data-size="l"]) {
  padding-block: calc(var(--space-2xs) * 1.5);
  padding-inline: var(--space-sm);
  margin: calc(var(--space-2xs) * -1.5) calc(var(--space-sm) * -1);
}

:where([data-button][data-variant="solid"]) {
  background-color: var(--accent-9);
  color: var(--accent-contrast);
}

@media (hover: hover) {
  :where([data-button][data-variant="solid"]:hover) {
    background-color: var(--accent-10);
  }
}

:where([data-button][data-variant="solid"][data-state="open"]) {
  background-color: var(--accent-10);
}

:where([data-button][data-variant="solid"]:active:not([data-state="open"])) {
  background-color: var(--accent-10);
  filter: brightness(0.92) saturate(1.1);
}

:where([data-button][data-variant="solid"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-button][data-variant="solid"][data-high-contrast]) {
  background-color: var(--accent-12);
  color: var(--gray-1);
}

@media (hover: hover) {
  :where([data-button][data-variant="solid"][data-high-contrast]:hover) {
    background-color: var(--accent-12);
    filter: contrast(0.88) saturate(1.1) brightness(1.1);
  }
}

:where([data-button][data-variant="solid"][data-high-contrast]:active:not([data-state="open"])) {
  background-color: var(--accent-12);
  filter: contrast(0.82) saturate(1.2) brightness(1.16);
}

:where([data-button][data-variant="solid"][data-disabled]) {
  background-color: var(--gray-a3);
  color: var(--gray-a8);
  filter: none;
}

:where([data-button][data-variant="soft"]) {
  background-color: var(--accent-a3);
  color: var(--accent-a11);
}

@media (hover: hover) {
  :where([data-button][data-variant="soft"]:hover) {
    background-color: var(--accent-a4);
  }
}

:where([data-button][data-variant="soft"][data-state="open"]) {
  background-color: var(--accent-a4);
}

:where([data-button][data-variant="soft"]:active:not([data-state="open"])) {
  background-color: var(--accent-a5);
}

:where([data-button][data-variant="soft"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="soft"][data-high-contrast]) {
  color: var(--accent-12);
}

:where([data-button][data-variant="soft"][data-disabled]) {
  background-color: var(--gray-a3);
  color: var(--gray-a8);
}

:where([data-button][data-variant="surface"]) {
  background-color: var(--accent-surface);
  box-shadow: inset 0 0 0 var(--border-width) var(--accent-a7);
  color: var(--accent-a11);
}

@media (hover: hover) {
  :where([data-button][data-variant="surface"]:hover) {
    box-shadow: inset 0 0 0 var(--border-width) var(--accent-a8);
  }
}

:where([data-button][data-variant="surface"][data-state="open"]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--accent-a8);
}

:where([data-button][data-variant="surface"]:active:not([data-state="open"])) {
  background-color: var(--accent-a3);
  box-shadow: inset 0 0 0 var(--border-width) var(--accent-a8);
}

:where([data-button][data-variant="surface"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="surface"][data-high-contrast]) {
  color: var(--accent-12);
}

:where([data-button][data-variant="surface"][data-disabled]) {
  background-color: var(--gray-a2);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a6);
  color: var(--gray-a8);
}

:where([data-button][data-variant="outline"]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--accent-a8);
  color: var(--accent-a11);
}

@media (hover: hover) {
  :where([data-button][data-variant="outline"]:hover) {
    background-color: var(--accent-a2);
  }
}

:where([data-button][data-variant="outline"][data-state="open"]) {
  background-color: var(--accent-a2);
}

:where([data-button][data-variant="outline"]:active:not([data-state="open"])) {
  background-color: var(--accent-a3);
}

:where([data-button][data-variant="outline"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="outline"][data-high-contrast]) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--accent-a7),
    inset 0 0 0 var(--border-width) var(--gray-a11);
  color: var(--accent-12);
}

:where([data-button][data-variant="outline"][data-disabled]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a7);
  color: var(--gray-a8);
}

@media (hover: hover) {
  :where([data-button][data-variant="ghost"]:hover) {
    background-color: var(--bg-hover);
  }
}

:where([data-button][data-variant="ghost"][data-state="open"]) {
  background-color: var(--bg-hover);
}

:where([data-button][data-variant="ghost"]:active:not([data-state="open"])) {
  background-color: var(--accent-a4);
}

:where([data-button][data-variant="ghost"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="ghost"][data-high-contrast]) {
  color: var(--accent-12);
}

:where([data-button][data-variant="ghost"][data-disabled]) {
  background-color: transparent;
  color: var(--gray-a8);
}

:where([data-button]:focus-visible[data-accent-color="red"]) {
  outline-color: var(--danger-text);
}

:where([data-button][data-variant="classic"]) {
  position: relative;
  z-index: 0;
  background-color: var(--accent-9);
  background-image:
    linear-gradient(to bottom, transparent 50%, var(--gray-a4)),
    linear-gradient(to bottom, transparent 50%, var(--accent-9) 80%);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a4),
    inset 0 -2px 1px var(--gray-a3),
    inset 0 0 0 var(--border-width) var(--accent-9),
    inset 0 4px 2px -2px var(--white-a9),
    inset 0 2px 1px -1px var(--white-a9);
  color: var(--accent-contrast);
}

:where([data-button][data-variant="classic"])::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: var(--z-behind);
  border-radius: inherit;
  border: 2px solid transparent;
  background-clip: content-box;
  background-color: inherit;
  background-image: linear-gradient(var(--black-a1), transparent, var(--white-a2));
  box-shadow: inset 0 2px 3px -1px var(--white-a4);
  pointer-events: none;
}

html.dark :where([data-button][data-variant="classic"]) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--white-a2),
    inset 0 4px 2px -2px var(--white-a3),
    inset 0 1px 1px var(--white-a6),
    inset 0 -1px 1px var(--black-a6),
    inset 0 0 0 var(--border-width) var(--accent-9);
}

html.dark :where([data-button][data-variant="classic"])::after {
  border-width: 1px;
}

:where([data-button][data-variant="classic"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-button][data-variant="classic"][data-high-contrast]) {
  background-color: var(--accent-12);
  background-image:
    linear-gradient(to bottom, transparent 50%, var(--gray-a4)),
    linear-gradient(to bottom, transparent 50%, var(--accent-12) 80%);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a4),
    inset 0 -2px 1px var(--gray-a3),
    inset 0 0 0 var(--border-width) var(--accent-12),
    inset 0 4px 2px -2px var(--white-a9),
    inset 0 2px 1px -1px var(--white-a9);
  color: var(--gray-1);
}

:where([data-button][data-variant="classic"][data-high-contrast])::after {
  background-image: linear-gradient(var(--black-a3), transparent, var(--white-a2));
}

@media (hover: hover) {
  :where([data-button][data-variant="classic"]:hover)::after {
    background-color: var(--accent-10);
    background-image: linear-gradient(var(--black-a2) -15%, transparent, var(--white-a3));
  }

  :where([data-button][data-variant="classic"][data-high-contrast]:hover) {
    filter: contrast(0.88) saturate(1.1) brightness(1.1);
  }

  :where([data-button][data-variant="classic"][data-high-contrast]:hover)::after {
    background-color: var(--accent-12);
    background-image: linear-gradient(var(--black-a5), transparent, var(--white-a2));
  }
}

:where([data-button][data-variant="classic"][data-state="open"])::after {
  background-color: var(--accent-10);
  background-image: linear-gradient(var(--black-a2) -15%, transparent, var(--white-a3));
}

:where([data-button][data-variant="classic"][data-state="open"][data-high-contrast]) {
  filter: contrast(0.88) saturate(1.1) brightness(1.1);
}

:where([data-button][data-variant="classic"][data-state="open"][data-high-contrast])::after {
  background-color: var(--accent-12);
  background-image: linear-gradient(var(--black-a5), transparent, var(--white-a2));
}

:where([data-button][data-variant="classic"]:active:not([data-state="open"], [data-disabled])) {
  background-color: var(--accent-9);
  background-image: linear-gradient(var(--black-a1), transparent);
  box-shadow:
    inset 0 4px 2px -2px var(--gray-a4),
    inset 0 1px 1px var(--gray-a7),
    inset 0 0 0 var(--border-width) var(--gray-a5),
    inset 0 0 0 var(--border-width) var(--accent-9),
    inset 0 3px 2px var(--gray-a3),
    inset 0 0 0 var(--border-width) var(--white-a7),
    inset 0 -2px 1px var(--white-a5);
  padding-block-start: 2px;
}

:where(
  [data-button][data-variant="classic"][data-size="s"]:active:not(
      [data-state="open"],
      [data-disabled]
    )
) {
  padding-block-start: 1px;
}

:where(
  [data-button][data-variant="classic"]:active:not([data-state="open"], [data-disabled])
)::after {
  background-color: inherit;
  background-image: linear-gradient(var(--black-a2), transparent, var(--white-a3));
  box-shadow: none;
}

:where([data-button][data-variant="classic"][data-disabled]) {
  background-color: var(--gray-2);
  background-image: none;
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a4),
    inset 0 -2px 1px var(--gray-a3);
  color: var(--gray-a8);
  outline: none;
  filter: none;
}

:where([data-button][data-variant="classic"][data-disabled])::after {
  background-color: var(--gray-a2);
  background-image: linear-gradient(var(--black-a1) -20%, transparent, var(--white-a1));
  box-shadow: none;
}
</style>
