<template>
  <component :is="tag" data-slot="table-cell" :data-kind="kind" :scope="scope">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue"

/** Cell / ColumnHeaderCell / RowHeaderCell 合成一个，用 kind 区分 */
const props = withDefaults(defineProps<{ kind?: "cell" | "column-header" | "row-header" }>(), {
  kind: "cell",
})
const tag = computed(() => (props.kind === "cell" ? "td" : "th"))
const scope = computed(() =>
  props.kind === "column-header" ? "col" : props.kind === "row-header" ? "row" : undefined,
)
</script>
