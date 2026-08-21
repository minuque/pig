<template>
  <svg
    v-if="glyph"
    class="vendor-mark"
    :width="size"
    :height="size"
    :viewBox="glyph.viewBox"
    aria-hidden="true"
  >
    <path
      v-for="(path, index) in glyph.paths"
      :key="index"
      :d="path.d"
      :fill="path.fill ?? 'currentColor'"
      :fill-rule="path.fillRule"
    />
  </svg>
  <span v-else class="vendor-mark vendor-fallback" :style="fallbackStyle">{{ letter }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { vendorDisplayName, vendorGlyph } from "@features/chat-input/lib/vendor-logo.js";

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

const glyph = computed(() => vendorGlyph(props.vendor || props.name));
const letter = computed(() => {
  const label = vendorDisplayName(props.vendor || props.name) || props.name || props.vendor;
  return label.charAt(0).toUpperCase() || "?";
});
const fallbackStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(8, props.size * 0.6)}px`,
}));
</script>

<style scoped>
.vendor-mark {
  display: inline-block;
  flex: none;
  vertical-align: middle;
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
