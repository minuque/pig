<!-- 会话状态图标：侧栏行右侧与页脚计数共用。 -->
<template>
  <span class="state-icon">
    <svg
      v-if="state === 'running'"
      class="state-spinner motion-spin"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle class="spinner-track" cx="12" cy="12" r="10" pathLength="100" />
      <circle class="spinner-arc" cx="12" cy="12" r="10" pathLength="100" />
    </svg>

    <CheckCircleIcon v-else-if="state === 'unread'" :size="14" class="state-glyph unread" />
    <PenIcon v-else-if="state === 'draft'" :size="14" class="state-glyph draft" />
    <DangerCircleIcon v-else-if="state === 'error'" :size="14" class="state-glyph error" />
  </span>
</template>

<script setup lang="ts">
import { CheckCircleIcon, DangerCircleIcon, PenIcon } from "@components/icons/index.js"
import type { SidebarStateGlyph } from "@features/session-nav/type.js"

defineProps<{
  state: SidebarStateGlyph
}>()
</script>

<style scoped>
.state-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  inline-size: 14px;
  block-size: 14px;
}

/* 运行中：暗色整环当轨道，亮弧转圈，比缺口图标更像进度 */
.state-spinner {
  display: block;
  inline-size: 14px;
  block-size: 14px;
  color: var(--state-working);
}

.spinner-track,
.spinner-arc {
  fill: none;
  stroke-width: 3;
}

.spinner-track {
  stroke: var(--hover-strong);
}

.spinner-arc {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 26 74;
}

.state-glyph {
  display: block;
}

.state-glyph.unread {
  color: var(--success);
}

.state-glyph.draft {
  color: var(--warning);
}

.state-glyph.error {
  color: var(--danger);
}
</style>
