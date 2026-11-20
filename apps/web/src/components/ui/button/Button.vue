<template>
  <Primitive
    data-button
    data-slot="button"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
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
import type { Size, ToneColor } from "@/types/ui-type.js"
import type { ButtonVariant, Radius } from "./index.js"
import ButtonContent from "./ButtonContent.vue"

defineOptions({ inheritAttrs: false })

interface Props extends PrimitiveProps {
  variant?: ButtonVariant
  size?: Size
  color?: ToneColor
  radius?: Radius
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
   底色与文字色读 `--tone-*` 槽位，换 color 时整组跟随。 */
:where([data-button]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  appearance: none;
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

/* 实心按钮的图标压一档透明度，与文字对齐观感 */
:where([data-button]:not([data-variant="ghost"])) :where(svg) {
  opacity: 0.9;
}

/* --- 尺寸 --- */
:where([data-button]:not([data-slot="icon-button"])[data-size="s"]) {
  height: var(--space-lg);
  gap: var(--space-2xs);
  padding-inline: var(--space-xs);
  border-radius: calc(var(--radius-control) / 2);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-button]:not([data-slot="icon-button"])[data-size="m"]) {
  height: var(--control-md);
  gap: var(--space-xs);
  padding-inline: var(--space-sm);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-button]:not([data-slot="icon-button"])[data-size="l"]) {
  height: var(--control-lg);
  gap: var(--space-sm);
  padding-inline: var(--space-md);
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

/* --- 圆角档 --- */
:where([data-button][data-radius="none"]) {
  border-radius: 0;
}

:where([data-button][data-radius="small"]) {
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-button][data-radius="medium"]) {
  border-radius: var(--radius-control);
}

:where([data-button][data-radius="large"]) {
  border-radius: var(--radius-card);
}

:where([data-button][data-radius="full"]) {
  border-radius: var(--radius-pill);
}

/* 幽灵按钮不占盒：内边距撑高，负外边距抵回视觉对齐（rt 的原样做法） */
:where([data-button]:not([data-slot="icon-button"])[data-variant="ghost"]) {
  box-sizing: content-box;
  height: fit-content;
  padding-block: var(--space-2xs);
  padding-inline: var(--space-xs);
  margin: calc(var(--space-2xs) * -1);
  color: var(--tone-text);
}

:where([data-button]:not([data-slot="icon-button"])[data-variant="ghost"][data-size="l"]) {
  padding-block: calc(var(--space-2xs) * 1.5);
  padding-inline: var(--space-sm);
  margin: calc(var(--space-2xs) * -1.5) calc(var(--space-sm) * -1);
}

/* --- solid --- */
:where([data-button][data-variant="solid"]) {
  background-color: var(--tone);
  color: var(--fg-on-accent);
}

@media (hover: hover) {
  :where([data-button][data-variant="solid"]:hover) {
    background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  }
}

:where([data-button][data-variant="solid"][data-state="open"]) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
}

:where([data-button][data-variant="solid"]:active:not([data-state="open"])) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  filter: brightness(0.92) saturate(1.1);
}

:where([data-button][data-variant="solid"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-button][data-variant="solid"][data-disabled]) {
  background-color: var(--bg-muted);
  background-image: none;
  color: var(--fg-disabled);
  filter: none;
}

/* --- soft --- */
:where([data-button][data-variant="soft"]) {
  background-color: var(--tone-subtle);
  color: var(--tone-text);
}

@media (hover: hover) {
  :where([data-button][data-variant="soft"]:hover) {
    background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  }
}

:where([data-button][data-variant="soft"][data-state="open"]) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
}

:where([data-button][data-variant="soft"]:active:not([data-state="open"])) {
  background-image: linear-gradient(var(--bg-emphasis), var(--bg-emphasis));
}

:where([data-button][data-variant="soft"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="soft"][data-disabled]) {
  background-color: var(--bg-muted);
  background-image: none;
  color: var(--fg-disabled);
}

/* --- surface --- */
:where([data-button][data-variant="surface"]) {
  background-color: var(--tone-subtle);
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
  color: var(--tone-text);
}

@media (hover: hover) {
  :where([data-button][data-variant="surface"]:hover) {
    background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  }
}

:where([data-button][data-variant="surface"][data-state="open"]) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
}

:where([data-button][data-variant="surface"]:active:not([data-state="open"])) {
  background-image: linear-gradient(var(--bg-emphasis), var(--bg-emphasis));
}

:where([data-button][data-variant="surface"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="surface"][data-disabled]) {
  background-color: var(--bg-muted);
  background-image: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
  color: var(--fg-disabled);
}

/* --- outline --- */
:where([data-button][data-variant="outline"]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--tone-border);
  color: var(--tone-text);
}

@media (hover: hover) {
  :where([data-button][data-variant="outline"]:hover) {
    background-color: var(--tone-subtle);
  }
}

:where([data-button][data-variant="outline"][data-state="open"]) {
  background-color: var(--tone-subtle);
}

:where([data-button][data-variant="outline"]:active:not([data-state="open"])) {
  background-color: var(--tone-subtle);
}

:where([data-button][data-variant="outline"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="outline"][data-disabled]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
  color: var(--fg-disabled);
}

/* --- ghost --- */
@media (hover: hover) {
  :where([data-button][data-variant="ghost"]:hover) {
    background-color: var(--bg-hover);
  }
}

:where([data-button][data-variant="ghost"][data-state="open"]) {
  background-color: var(--bg-hover);
}

:where([data-button][data-variant="ghost"]:active:not([data-state="open"])) {
  background-color: var(--bg-emphasis);
}

:where([data-button][data-variant="ghost"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-button][data-variant="ghost"][data-disabled]) {
  background-color: transparent;
  color: var(--fg-disabled);
}

/* 危险色按钮的焦点环跟文字档同色，灰底上更清楚 */
:where([data-button]:focus-visible[data-tone="danger"]) {
  outline-color: var(--danger-text);
}

/* 加载态：spinner 绝对定位在按钮内，按钮自己提供定位上下文 */
:where([data-button][data-loading]) {
  position: relative;
}
</style>
