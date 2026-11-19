<template>
  <TabsList
    data-slot="tabs-list"
    :data-variant="variant"
    :data-size="size"
    :data-accent-color="color"
    :class="[
      variant === 'underline' && ['rt-BaseTabList', 'rt-TabsList', sizeClass],
      highContrast && 'rt-high-contrast',
      props.class,
    ]"
  >
    <slot />
    <TabsIndicator v-if="variant === 'segmented'" class="segmented-indicator" />
  </TabsList>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, provide, toRef } from "vue"
import { TabsIndicator, TabsList } from "reka-ui"
import { sizeClass as rtSizeClass } from "@components/ui/rt/size.js"
import { TABS_VARIANT, type TabsVariant } from "./context.js"

/** rt 的标签栏只有 1、2 两档，对应这里的 s、m；segmented 两档高 26、36px */
const props = withDefaults(
  defineProps<{
    variant?: TabsVariant
    size?: "s" | "m"
    color?: string | undefined
    highContrast?: boolean
    class?: HTMLAttributes["class"] | undefined
  }>(),
  { variant: "underline", size: "m", color: undefined, highContrast: false, class: undefined },
)
const sizeClass = computed(() => rtSizeClass(props.size))

provide(TABS_VARIANT, toRef(props, "variant"))
</script>

<style scoped>
/* 凹槽底 + 细环，选中块上下内缩 2px，圆角同心 */
[data-variant="segmented"] {
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

[data-variant="segmented"][data-size="s"] {
  block-size: calc(var(--spacing) * 6.5);
  border-radius: var(--radius-control);
  font-size: var(--text-meta);
}

.segmented-indicator {
  position: absolute;
  z-index: -1;
  inset-block: 2px;
  inset-inline-start: 0;
  inline-size: var(--reka-tabs-indicator-size);
  border-radius: calc(var(--radius-card) - 2px);
  background: var(--bg-surface);
  box-shadow: 0 0 0 var(--border-width) var(--border-strong);
  transform: translateX(var(--reka-tabs-indicator-position));
  transition-property: transform, inline-size;
  transition-duration: var(--duration-normal);
  transition-timing-function: var(--ease-out);
}

[data-size="s"] .segmented-indicator {
  border-radius: calc(var(--radius-control) - 2px);
}

@media (prefers-reduced-motion: reduce) {
  .segmented-indicator {
    transition: none;
  }
}
</style>
