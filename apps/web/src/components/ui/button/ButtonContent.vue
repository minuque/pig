<template>
  <template v-if="loading">
    <!-- 与 rt 一致：内容藏在视觉层，读屏名由下面的副本补回 -->
    <span class="button-label" aria-hidden="true"><slot /></span>
    <span class="sr-only"><slot /></span>
    <span class="button-spinner"><Spinner :size="spinnerSize" /></span>
  </template>

  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Spinner } from "@components/ui/spinner/index.js"
import type { Size } from "@components/ui/rt/size.js"

const props = withDefaults(defineProps<{ loading?: boolean; size?: Size }>(), {
  loading: false,
  size: "m",
})
/** 跟 rt 的映射：s 用 12px，m 与 l 用 16px */
const spinnerSize = computed(() => (props.size === "s" ? 12 : 16))
</script>

<style scoped>
/* display: contents 保留按钮的 flex 布局；visibility 藏内容但留占位 */
.button-label {
  display: contents;
  visibility: hidden;
}

/* rt 的 .rt-loading 已给按钮 position: relative */
.button-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
