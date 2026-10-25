<template>
  <Teleport to="body">
    <!-- 需行动/需知悉：顶部 banner 层，挤压视口提示权重最高 -->
    <TransitionGroup name="banner" tag="div" class="banner-layer">
      <div v-for="item in noticeQueue" :key="item.id" class="banner-item">
        <Callout
          variant="soft"
          color="destructive"
          dismissible
          floating
          class="banner-alert"
          @close="dismissNotice(item.id)"
        >
          <template #icon><DangerCircleIcon /></template>
          <template #title>{{ t("common.error") }}</template>
          <template #default>{{ item.message }}</template>
        </Callout>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"

import { Callout } from "@components/ui/callout/index.js"
import { dismissNotice, noticeQueue } from "@components/layout/notify.js"
import { DangerCircleIcon } from "@components/icons/index.js"

const { t } = useI18n()
</script>

<style scoped>
/* 顶部 banner：横向通栏，从顶下滑 */
.banner-layer {
  position: fixed;
  inset-block-start: calc(var(--titlebar-inset, 0px));
  inset-inline: 0;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  padding: var(--space-xs) var(--space-md);
  pointer-events: none;
}

.banner-item {
  pointer-events: auto;
}

.banner-alert {
  box-shadow: var(--shadow-elevated);
}

.banner-enter-active,
.banner-leave-active {
  transition:
    opacity var(--duration-slow) var(--ease-smooth),
    transform var(--duration-slow) var(--ease-smooth);
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.banner-move {
  transition: transform var(--duration-slow) var(--ease-smooth);
}

@media (prefers-reduced-motion: reduce) {
  .banner-enter-active,
  .banner-leave-active,
  .banner-move {
    transition: none;
  }
}
</style>
