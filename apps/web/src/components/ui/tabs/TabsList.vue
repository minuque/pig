<template>
  <TabsList
    data-slot="tabs-list"
    :data-variant="variant"
    :data-size="size"
    :data-accent-color="color"
    :class="props.class"
  >
    <slot />
    <TabsIndicator v-if="variant === 'segmented'" class="segmented-indicator" />
  </TabsList>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { provide, toRef } from "vue"
import { TabsIndicator, TabsList } from "reka-ui"
import { TABS_VARIANT, type TabsVariant } from "./context.js"

/** 标签栏只有 s、m 两档；segmented 两档高 26、36px */
const props = withDefaults(
  defineProps<{
    variant?: TabsVariant
    size?: "s" | "m"
    color?: string | undefined
    class?: HTMLAttributes["class"] | undefined
  }>(),
  { variant: "underline", size: "m", color: undefined, class: undefined },
)

provide(TABS_VARIANT, toRef(props, "variant"))
</script>

<style>
/* 下划线标签栏：整条底部一条细线，选中项底边压 2px 强调色 */
:where([data-slot="tabs-list"][data-variant="underline"]) {
  display: flex;
  justify-content: flex-start;
  overflow-x: auto;
  white-space: nowrap;
  box-shadow: inset 0 -1px 0 0 var(--gray-a5);
  font-family: var(--font-sans);
  font-style: normal;
  scrollbar-width: none;
}

:where([data-slot="tabs-list"][data-variant="underline"])::-webkit-scrollbar {
  display: none;
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="s"]) {
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="m"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

/* 触发器：图标与文字居中，选中态靠底部色条表达 */
:where([data-slot="tabs-list"][data-variant="underline"]) :where([data-slot="tabs-trigger"]) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  padding-inline: var(--space-xs);
  user-select: none;
  color: var(--gray-a11);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="s"])
  :where([data-slot="tabs-trigger"]) {
  height: var(--space-2xl);
  padding-inline: var(--space-2xs);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="m"])
  :where([data-slot="tabs-trigger"]) {
  height: var(--control-lg);
}

@media (hover: hover) {
  :where([data-slot="tabs-list"][data-variant="underline"])
    :where([data-slot="tabs-trigger"]:hover) {
    color: var(--gray-12);
  }

  :where([data-slot="tabs-list"][data-variant="underline"])
    :where([data-slot="tabs-trigger"]:hover)
    :where([data-slot="tabs-trigger-inner"]) {
    background-color: var(--gray-a3);
  }
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger"][data-state="active"]) {
  color: var(--gray-12);
  font-weight: var(--font-weight-medium);
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger"][data-state="active"])::before {
  content: "";
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  box-sizing: border-box;
  height: 2px;
  background-color: var(--accent-indicator);
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger"]:focus-visible) {
  outline: none;
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger"]:focus-visible)
  :where([data-slot="tabs-trigger-inner"]) {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

/* 内层：隐藏的加粗副本占位，可见层绝对定位叠在上面，切换选中时宽度不跳 */
:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger-inner"], [data-slot="tabs-trigger-inner-hidden"]) {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

:where([data-slot="tabs-list"][data-variant="underline"]) :where([data-slot="tabs-trigger-inner"]) {
  position: absolute;
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="s"])
  :where([data-slot="tabs-trigger-inner"], [data-slot="tabs-trigger-inner-hidden"]) {
  padding: calc(var(--space-2xs) * 0.5) var(--space-2xs);
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="tabs-list"][data-variant="underline"][data-size="m"])
  :where([data-slot="tabs-trigger-inner"], [data-slot="tabs-trigger-inner-hidden"]) {
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
}

:where([data-slot="tabs-list"][data-variant="underline"])
  :where([data-slot="tabs-trigger-inner-hidden"]) {
  visibility: hidden;
  font-weight: var(--font-weight-medium);
}

/* 凹槽底 + 细环，选中块上下内缩 2px，圆角同心 */
:where([data-slot="tabs-list"][data-variant="segmented"]) {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  align-self: flex-start;
  block-size: calc(var(--spacing) * 9);
  padding-inline: 2px;
  border-radius: var(--radius-card);
  background: var(--sidebar);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
  font-size: var(--text-body);
  isolation: isolate;
}

:where([data-slot="tabs-list"][data-variant="segmented"][data-size="s"]) {
  block-size: calc(var(--spacing) * 6.5);
  border-radius: var(--radius-control);
  font-size: var(--text-meta);
}

:where([data-slot="tabs-list"][data-variant="segmented"]) .segmented-indicator {
  position: absolute;
  z-index: var(--z-behind);
  inset-block: 2px;
  inset-inline-start: 0;
  inline-size: var(--reka-tabs-indicator-size);
  border-radius: calc(var(--radius-card) - 2px);
  background: var(--bg-raised);
  box-shadow: 0 0 0 var(--border-width) var(--border-strong);
  transform: translateX(var(--reka-tabs-indicator-position));
  transition-property: transform, inline-size;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-out);
}

:where([data-slot="tabs-list"][data-variant="segmented"][data-size="s"]) .segmented-indicator {
  border-radius: calc(var(--radius-control) - 2px);
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="tabs-list"][data-variant="segmented"]) .segmented-indicator {
    transition: none;
  }
}
</style>
