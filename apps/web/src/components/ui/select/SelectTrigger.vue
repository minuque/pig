<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
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
import type { ToneColor } from "@/types/ui-type.js"
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
      variant?: "surface" | "soft" | "ghost"
      color?: ToneColor
      radius?: Radius
      /** 未选中时显示的文案 */
      placeholder?: string
    }
  >(),
  { class: undefined, variant: "surface", placeholder: "" },
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
  color: var(--fg);
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

/* --- 圆角档 --- */
:where([data-slot="select-trigger"][data-radius="none"]) {
  border-radius: 0;
}

:where([data-slot="select-trigger"][data-radius="small"]) {
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="select-trigger"][data-radius="medium"]) {
  border-radius: var(--radius-control);
}

:where([data-slot="select-trigger"][data-radius="large"]) {
  border-radius: var(--radius-card);
}

:where([data-slot="select-trigger"][data-radius="full"]) {
  border-radius: var(--radius-pill);
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
  color: var(--fg);
}

:where([data-slot="select-trigger"][data-variant="ghost"][data-size="l"]) {
  padding-block: calc(var(--space-2xs) * 1.5);
  padding-inline: var(--space-sm);
  margin: calc(var(--space-2xs) * -1.5) calc(var(--space-sm) * -1);
}

/* --- surface --- */
:where([data-slot="select-trigger"][data-variant="surface"]) {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
}

@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="surface"]:hover) {
    background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  }
}

:where([data-slot="select-trigger"][data-variant="surface"][data-state="open"]) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
}

:where([data-slot="select-trigger"][data-variant="surface"]:disabled) {
  background-color: var(--bg-muted);
  background-image: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
  color: var(--fg-secondary);
}

/* --- soft --- */
:where([data-slot="select-trigger"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
  color: var(--fg);
}

@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="soft"]:hover) {
    background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
  }
}

:where([data-slot="select-trigger"][data-variant="soft"][data-state="open"]) {
  background-image: linear-gradient(var(--bg-hover), var(--bg-hover));
}

:where([data-slot="select-trigger"][data-variant="soft"]:disabled) {
  background-color: var(--bg-muted);
  background-image: none;
  color: var(--fg-secondary);
}

/* --- ghost --- */
@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="ghost"]:hover) {
    background-color: var(--tone-subtle);
  }
}

:where([data-slot="select-trigger"][data-variant="ghost"][data-state="open"]) {
  background-color: var(--tone-subtle);
}

:where([data-slot="select-trigger"][data-variant="ghost"]:disabled) {
  background-color: transparent;
  color: var(--fg-secondary);
}

/* 未选中时用占位灰；soft 与 ghost 退到半透明强调色 */
:where([data-slot="select-trigger"][data-variant="surface"][data-placeholder])
  :where([data-slot="select-trigger-inner"]) {
  color: var(--fg-muted);
}

:where(
    [data-slot="select-trigger"]:is([data-variant="soft"], [data-variant="ghost"])[data-placeholder]
  )
  :where([data-slot="select-trigger-inner"]) {
  color: var(--fg);
  opacity: 0.6;
}

:where([data-slot="select-trigger"]:disabled) :where([data-slot="select-icon"]) {
  color: var(--fg-muted);
}

:where([data-slot="select-trigger"]:not([data-variant="ghost"])) :where([data-slot="select-icon"]) {
  opacity: 0.9;
}
</style>
