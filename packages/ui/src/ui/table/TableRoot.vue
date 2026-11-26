<template>
  <div
    data-slot="table"
    :data-size="size"
    :data-variant="variant"
    :class="props.class"
    v-bind="$attrs"
  >
    <div data-slot="table-scroll">
      <table data-slot="table-element">
        <slot />
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { Size } from "../../core/types.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    size?: Size
    variant?: "surface" | "ghost"
    class?: HTMLAttributes["class"]
  }>(),
  { size: "m", variant: "ghost", class: undefined },
)
</script>

<style>
:where([data-slot="table-scroll"]) {
  max-width: 100%;
  overflow-x: auto;
}

:where([data-slot="table"][data-variant="surface"]) {
  position: relative;
  overflow: hidden;
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-card);
  background-color: var(--card-surface);
  background-clip: padding-box;
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
  border-block-end: var(--border-width) solid var(--border-subtle);
  box-sizing: border-box;
  vertical-align: inherit;
  font-variant-numeric: tabular-nums;
}

:where([data-slot="table-header"] [data-slot="table-cell"]) {
  border-block-end-color: var(--border);
}

:where([data-slot="table"][data-size="s"] [data-slot="table-cell"]) {
  padding: var(--space-xs);
  height: var(--control-lg);
}

:where([data-slot="table"][data-size="m"] [data-slot="table-cell"]) {
  padding: var(--space-sm);
  height: calc(var(--control-lg) + var(--space-xs));
}

:where([data-slot="table-cell"][data-kind="column-header"]) {
  font-weight: var(--font-weight-semibold);
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
  border-block-end: 0;
}
</style>
