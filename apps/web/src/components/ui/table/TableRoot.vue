<template>
  <div
    data-slot="table"
    class="rt-TableRoot"
    :class="[extracted.class, props.class]"
    :style="extracted.style"
    v-bind="$attrs"
  >
    <!-- rt 用 ScrollArea 包表格；这里用原生滚动容器承担横向溢出 -->
    <div class="table-scroll">
      <table class="rt-TableRootTable"><slot /></table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { extractProps, type PropDefs } from "@components/ui/rt/props.js"
import { RT_SIZE, type Size } from "@components/ui/rt/size.js"

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
const DEFS: PropDefs = {
  size: {
    type: "enum",
    values: ["s", "m", "l"],
    default: "m",
    className: "rt-r-size",
    valueMap: RT_SIZE,
  },
  variant: {
    type: "enum",
    values: ["surface", "ghost"],
    default: "ghost",
    className: "rt-variant",
  },
}
const extracted = computed(() => extractProps({ size: props.size, variant: props.variant }, DEFS))
</script>

<style scoped>
.table-scroll {
  max-width: 100%;
  overflow-x: auto;
}
</style>
