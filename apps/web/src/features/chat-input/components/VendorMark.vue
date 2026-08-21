<template>
  <img
    v-if="icon && !icon.tinted"
    class="vendor-mark"
    :src="icon.src"
    :width="size"
    :height="size"
    alt=""
  />
  <span v-else-if="icon" class="vendor-mark vendor-mark-mono" :style="monoStyle"></span>
  <span v-else class="vendor-mark vendor-fallback" :style="fallbackStyle">{{ letter }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { vendorDisplayName, vendorIcon } from "@features/chat-input/lib/vendor-logo.js";

const props = withDefaults(
  defineProps<{
    vendor?: string;
    name?: string;
    size?: number;
  }>(),
  {
    vendor: "",
    name: "",
    size: 12,
  },
);

const icon = computed(() => vendorIcon(props.vendor || props.name));
const letter = computed(() => {
  const label = vendorDisplayName(props.vendor || props.name) || props.name || props.vendor;
  return label.charAt(0).toUpperCase() || "?";
});
const box = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));
const fallbackStyle = computed(() => ({
  ...box.value,
  fontSize: `${Math.max(8, props.size * 0.6)}px`,
}));
const monoStyle = computed(() => ({
  ...box.value,
  webkitMaskImage: `url("${icon.value?.src}")`,
  maskImage: `url("${icon.value?.src}")`,
}));
</script>

<style scoped>
.vendor-mark {
  display: inline-block;
  flex: none;
  object-fit: contain;
  vertical-align: middle;
}
.vendor-mark-mono {
  color: var(--ink);
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}
.vendor-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--canvas-soft);
  color: var(--ink-muted);
  font-weight: 600;
  line-height: 1;
}
</style>
