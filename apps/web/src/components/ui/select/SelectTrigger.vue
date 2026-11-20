<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="size"
    :data-variant="variant"
    :data-accent-color="color"
    :data-radius="radius"
    v-bind="{ ...forwarded, ...$attrs }"
    :class="props.class"
  >
    <span data-slot="select-trigger-inner">
      <SelectValue :placeholder="placeholder"><slot /></SelectValue>
    </span>

    <SelectIcon data-slot="select-icon">
      <ChevronDownIcon />
    </SelectIcon>
  </SelectTrigger>
</template>

<script setup lang="ts">
import type { SelectTriggerProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectIcon, SelectTrigger, SelectValue, useForwardProps } from "reka-ui"
import type { Radius } from "@components/ui/button/index.js"
import { useSelectSize } from "@components/ui/select/select-context.js"
import { ChevronDownIcon } from "@components/icons/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    SelectTriggerProps & {
      class?: HTMLAttributes["class"]
      variant?: "classic" | "surface" | "soft" | "ghost"
      color?: string
      radius?: Radius
      /** 未选中时显示的文案 */
      placeholder?: string
    }
  >(),
  { class: undefined, variant: "classic", placeholder: "" },
)
const delegatedProps = reactiveOmit(props, "class", "variant", "color", "radius", "placeholder")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectTriggerProps>
const size = useSelectSize()
</script>

<style>
/* 选择框触发器：固定高度 + 左右等宽内边距，文字超长省略 */
:where([data-slot="select-trigger"]) {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-sizing: border-box;
  gap: calc(var(--space-2xs) * 1.5);
  height: var(--control-md);
  padding-inline: var(--space-sm);
  border-radius: var(--radius-control);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-align: start;
  white-space: nowrap;
  vertical-align: top;
  color: var(--gray-12);
  user-select: none;
  cursor: pointer;
}

:where([data-slot="select-trigger"][data-size="s"]) {
  gap: var(--space-2xs);
  height: var(--space-lg);
  padding-inline: var(--space-xs);
  border-radius: calc(var(--radius-control) / 2);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="select-trigger"][data-size="l"]) {
  gap: var(--space-xs);
  height: var(--control-lg);
  padding-inline: var(--space-md);
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

:where([data-slot="select-trigger"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-slot="select-trigger-inner"]) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where([data-slot="select-icon"]) {
  flex-shrink: 0;
}

/* 幽灵触发器不占盒：内边距撑高，负外边距抵回视觉对齐 */
:where([data-slot="select-trigger"][data-variant="ghost"]) {
  box-sizing: content-box;
  height: fit-content;
  padding-block: var(--space-2xs);
  padding-inline: var(--space-xs);
  margin: calc(var(--space-2xs) * -1);
  color: var(--accent-12);
}

:where([data-slot="select-trigger"][data-variant="ghost"][data-size="l"]) {
  padding-block: calc(var(--space-2xs) * 1.5);
  padding-inline: var(--space-sm);
  margin: calc(var(--space-2xs) * -1.5) calc(var(--space-sm) * -1);
}

/* --- surface --- */
:where([data-slot="select-trigger"][data-variant="surface"]) {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a7);
}

@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="surface"]:hover) {
    box-shadow: inset 0 0 0 var(--border-width) var(--gray-a8);
  }
}

:where([data-slot="select-trigger"][data-variant="surface"][data-state="open"]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a8);
}

:where([data-slot="select-trigger"][data-variant="surface"]:disabled) {
  background-color: var(--gray-a2);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a6);
  color: var(--gray-a11);
}

/* --- classic：凸起底，顶上亮、底下暗的一层内阴影 --- */
:where([data-slot="select-trigger"][data-variant="classic"]) {
  position: relative;
  background-image: linear-gradient(var(--gray-2), var(--gray-1));
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a5),
    inset 0 2px 1px var(--white-a11),
    inset 0 -2px 1px var(--gray-a4);
}

:where([data-slot="select-trigger"][data-variant="classic"])::before {
  content: "";
  position: absolute;
  z-index: var(--z-behind);
  inset: 0;
  border: 2px solid transparent;
  border-radius: inherit;
  background-clip: content-box;
  background-image:
    linear-gradient(var(--black-a1) -20%, transparent, var(--white-a1) 130%),
    linear-gradient(var(--bg-raised), transparent);
  pointer-events: none;
}

@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="classic"]:hover) {
    box-shadow:
      inset 0 0 0 var(--border-width) var(--gray-a3),
      inset 0 2px 1px var(--white-a11),
      inset 0 -2px 1px var(--gray-a4);
  }

  :where([data-slot="select-trigger"][data-variant="classic"]:hover)::before {
    background-image:
      linear-gradient(var(--black-a1) -15%, transparent, var(--white-a1) 120%),
      linear-gradient(var(--gray-2), var(--gray-1));
  }
}

:where([data-slot="select-trigger"][data-variant="classic"][data-state="open"]) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a3),
    inset 0 2px 1px var(--white-a11),
    inset 0 -2px 1px var(--gray-a4);
}

:where([data-slot="select-trigger"][data-variant="classic"][data-state="open"])::before {
  background-image:
    linear-gradient(var(--black-a1) -15%, transparent, var(--white-a1) 120%),
    linear-gradient(var(--gray-2), var(--gray-1));
}

:where([data-slot="select-trigger"][data-variant="classic"]:disabled) {
  background-color: var(--gray-2);
  background-image: none;
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a4),
    inset 0 -2px 1px var(--gray-a3);
  color: var(--gray-a11);
}

:where([data-slot="select-trigger"][data-variant="classic"]:disabled)::before {
  background-color: var(--gray-a2);
  background-image: linear-gradient(var(--black-a1) -20%, transparent, var(--white-a1));
}

/* 深色下换成顶亮线更弱、底暗线更重的一套，避免 90% 白的高光 */
html.dark :where([data-slot="select-trigger"][data-variant="classic"]) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--white-a4),
    inset 0 1px 1px var(--white-a4),
    inset 0 -1px 1px var(--black-a9);
}

html.dark :where([data-slot="select-trigger"][data-variant="classic"]:hover) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a3),
    inset 0 1px 1px var(--white-a4),
    inset 0 -1px 1px var(--black-a9);
}

html.dark :where([data-slot="select-trigger"][data-variant="classic"][data-state="open"]) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a3),
    inset 0 1px 1px var(--white-a4),
    inset 0 -1px 1px var(--black-a9);
}

html.dark :where([data-slot="select-trigger"][data-variant="classic"]:disabled) {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-a5),
    inset 0 4px 2px -2px var(--gray-a2),
    inset 0 1px 1px var(--gray-a5),
    inset 0 -1px 1px var(--black-a3);
}

/* --- soft --- */
:where([data-slot="select-trigger"][data-variant="soft"]) {
  background-color: var(--accent-a3);
  color: var(--accent-12);
}

@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="soft"]:hover) {
    background-color: var(--accent-a4);
  }
}

:where([data-slot="select-trigger"][data-variant="soft"][data-state="open"]) {
  background-color: var(--accent-a4);
}

:where([data-slot="select-trigger"][data-variant="soft"]:focus-visible) {
  outline-color: var(--accent-8);
}

:where([data-slot="select-trigger"][data-variant="soft"]:disabled) {
  background-color: var(--gray-a3);
  color: var(--gray-a11);
}

/* --- ghost --- */
@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="ghost"]:hover) {
    background-color: var(--accent-a3);
  }
}

:where([data-slot="select-trigger"][data-variant="ghost"][data-state="open"]) {
  background-color: var(--accent-a3);
}

:where([data-slot="select-trigger"][data-variant="ghost"]:disabled) {
  background-color: transparent;
  color: var(--gray-a11);
}

/* 未选中时用占位灰；soft 与 ghost 退到半透明强调色 */
:where(
    [data-slot="select-trigger"]:is(
        [data-variant="surface"],
        [data-variant="classic"]
      )[data-placeholder]
  )
  :where([data-slot="select-trigger-inner"]) {
  color: var(--gray-a10);
}

:where(
    [data-slot="select-trigger"]:is([data-variant="soft"], [data-variant="ghost"])[data-placeholder]
  )
  :where([data-slot="select-trigger-inner"]) {
  color: var(--accent-12);
  opacity: 0.6;
}

:where([data-slot="select-trigger"]:disabled) :where([data-slot="select-icon"]) {
  color: var(--gray-a9);
}

:where([data-slot="select-trigger"]:not([data-variant="ghost"])) :where([data-slot="select-icon"]) {
  opacity: 0.9;
}
</style>
