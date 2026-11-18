<template>
  <div class="copy-pin">
    <span class="copy-backdrop"><CopyButton :text="text" /></span>
  </div>
</template>

<script setup lang="ts">
import CopyButton from "@features/transcript-view/components/CopyButton.vue"

defineProps<{ text: string }>()
</script>

<style scoped>
/* 放进滚动区并钉在可视区右上角，滚动条由布局让开；垫一块实底挡住滚过的文字；不抬层级，卡片描边仍画在它上面 */
.copy-pin {
  position: sticky;
  top: 0;
  left: 0;
  flex: none;
  height: 0;
}

/* 默认按滚动区上内边距 xs、右内边距 sm + 22px 对齐；内边距不同的父级改 top。
   实底与按钮同大同圆角，颜色取所在卡片的底色（透明卡片露出页面底色） */
.copy-backdrop {
  position: absolute;
  top: calc(var(--space-2xs) - var(--space-xs));
  inset-inline-end: calc(var(--space-2xs) - var(--space-sm) - 22px);
  display: flex;
  border-radius: var(--radius-control);
  background:
    linear-gradient(var(--card-background-color), var(--card-background-color)), var(--bg);
  white-space: normal;
}

.copy-backdrop :deep(.copy-button) {
  position: static;
}
</style>
