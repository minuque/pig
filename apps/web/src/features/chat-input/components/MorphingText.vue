<template>
  <span class="morph" :style="{ width: widthPx }">
    <span ref="sizer" class="sizer">{{ text }}</span>
    <span :key="text" class="face">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef, watch } from "vue";

const props = defineProps<{
  text: string;
}>();

const sizer = useTemplateRef<HTMLElement>("sizer");
const widthPx = ref("auto");

async function measure() {
  await nextTick();
  const el = sizer.value;
  if (el) widthPx.value = `${el.offsetWidth}px`;
}

watch(() => props.text, measure);
onMounted(measure);
</script>

<style scoped>
.morph {
  position: relative;
  display: inline-flex;
  overflow: hidden;
  vertical-align: bottom;
  transition: width 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.sizer {
  visibility: hidden;
  white-space: nowrap;
  pointer-events: none;
}
.face {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  animation: morph-in 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes morph-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .morph {
    transition: none;
  }
  .face {
    animation: none;
  }
}
</style>
