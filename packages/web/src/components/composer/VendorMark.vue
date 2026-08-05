<template>
  <span class="vendor-fallback" :style="style">{{ letter }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ name?: string; size?: number }>(), {
  name: "",
  size: 12,
});

/** 供应商品牌标记：中性首字母圆点；品牌名来自 catalog 数据，不硬编码 */
const letter = computed(() => props.name.charAt(0).toUpperCase() || "?");
const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(8, props.size * 0.6)}px`,
}));
</script>

<style scoped>
.vendor-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 999px;
  background: var(--canvas-soft);
  color: var(--ink-muted);
  font-weight: 600;
  line-height: 1;
}
</style>
