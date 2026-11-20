<template>
  <div
    data-slot="table"
    :data-size="size"
    :data-variant="variant"
    :class="props.class"
    v-bind="$attrs"
  >
    <!-- 用原生滚动容器承担横向溢出 -->
    <div class="table-scroll">
      <table data-slot="table-element">
        <slot />
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { Size } from "@components/ui/rt/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** 尺寸档：s、m、l */
    size?: Size
    variant?: "surface" | "ghost"
    class?: HTMLAttributes["class"]
  }>(),
  { size: "m", variant: "ghost", class: undefined },
)
</script>

<style scoped>
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
}
</style>

<style>
:where([data-slot="table"][data-variant="surface"]) {
  position: relative;
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-card);
  background-color: var(--card-surface);
  background-clip: padding-box;
}

:where([data-slot="table"][data-variant="surface"])::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  pointer-events: none;
}

:where([data-slot="table-element"]) {
  width: 100%;
  text-align: left;
  vertical-align: top;
  border-collapse: collapse;
  border-spacing: 0;
  box-sizing: border-box;
  height: 0;
}

:where([data-slot="table"][data-size="s"] [data-slot="table-element"]),
:where([data-slot="table"][data-size="m"] [data-slot="table-element"]) {
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="table"][data-size="l"] [data-slot="table-element"]) {
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

:where([data-slot="table-header"]),
:where([data-slot="table-body"]) {
  vertical-align: inherit;
}

:where([data-slot="table-row"]) {
  vertical-align: inherit;
  color: var(--fg);
}

:where([data-slot="table-cell"]) {
  background-color: transparent;
  box-shadow: inset 0 -1px var(--gray-a5);
  box-sizing: border-box;
  vertical-align: inherit;
}

:where([data-slot="table"][data-size="s"] [data-slot="table-cell"]) {
  padding: var(--space-xs);
  height: 36px;
}

:where([data-slot="table"][data-size="m"] [data-slot="table-cell"]) {
  padding: var(--space-sm);
  height: 44px;
}

:where([data-slot="table"][data-size="l"] [data-slot="table-cell"]) {
  padding: var(--space-sm) var(--space-md);
  height: 48px;
}

:where([data-slot="table-cell"][data-kind="column-header"]) {
  font-weight: var(--font-weight-bold);
}

:where([data-slot="table-cell"][data-kind="row-header"]) {
  font-weight: var(--font-weight-normal);
}

:where(
  [data-slot="table"][data-variant="surface"] [data-slot="table-header"] [data-slot="table-cell"]
) {
  background-color: var(--bg-surface);
}

:where(
  [data-slot="table"][data-variant="surface"]
    [data-slot="table-body"]
    [data-slot="table-row"]:last-child
    [data-slot="table-cell"]
) {
  box-shadow: none;
}
</style>
