<template>
  <svg
    class="sidebar-glyph"
    :class="{ open, right }"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect class="frame" x="3" y="4" width="18" height="16" rx="4" />
    <rect class="panel" y="7.5" height="9" rx="0.875" />
  </svg>
</template>

<script setup lang="ts">
/** 侧栏开合形变图标：面板宽度随 open 在 1.75 与 5.5 之间过渡，收展各用一次。 */
defineProps<{
  open: boolean
  right?: boolean
}>()
</script>

<style scoped>
.sidebar-glyph {
  display: block;
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  /* 收起态宽度 1.75 / 展开态 5.5 */
  --glyph-panel-closed: 0.31818;
}

.frame {
  stroke: currentColor;
  stroke-width: var(--line-icon-width);
}

.panel {
  x: 6.5px;
  width: 5.5px;
  fill: currentColor;
  transform: scaleX(var(--glyph-panel-closed));
  transform-origin: left center;
  transition: transform var(--duration-slow) var(--ease-smooth);
}

.right .panel {
  x: 12px;
  transform-origin: right center;
}

.open .panel {
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: none;
  }
}
</style>
