<!-- 会话状态图标：侧栏行右侧与页脚计数共用。 -->
<template>
  <span class="state-icon" :class="state">
    <svg
      v-if="state === 'running'"
      class="state-spinner motion-spin"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle class="spinner-track" cx="12" cy="12" r="10" pathLength="100" />
      <circle class="spinner-arc" cx="12" cy="12" r="10" pathLength="100" />
    </svg>

    <template v-else-if="state === 'unread'">
      <CheckCircleIcon :size="14" class="state-glyph" />
      <span class="state-label">{{ t("session.done") }}</span>
    </template>

    <template v-else-if="state === 'error'">
      <DangerCircleIcon :size="14" class="state-glyph" />
      <span class="state-label">{{ t("session.failed") }}</span>
    </template>

    <PenIcon v-else-if="state === 'draft'" :size="14" class="state-glyph" />
  </span>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { CheckCircleIcon, DangerCircleIcon, PenIcon } from "@components/icons/index.js"
import type { SidebarStateGlyph } from "@features/session-nav/type.js"

defineProps<{
  state: SidebarStateGlyph
}>()

const { t } = useI18n()
</script>

<style scoped>
.state-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  min-inline-size: 14px;
  min-block-size: 14px;
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

.state-label {
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
}

.state-icon.unread {
  color: var(--success);
}

.state-icon.draft {
  color: var(--warning);
}

.state-icon.error {
  color: var(--danger);
}
</style>
