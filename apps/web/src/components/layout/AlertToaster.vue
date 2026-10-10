<template>
  <Teleport to="body">
    <!-- 需行动/需知悉：顶部 banner 层，挤压视口提示权重最高 -->
    <TransitionGroup name="banner" tag="div" class="banner-layer">
      <div v-for="item in actionItems" :key="item.id" class="banner-item">
        <Alert
          variant="error"
          dismissible
          floating
          class="banner-alert"
          @close="dismissNotice(item.id)"
        >
          <template #icon><DangerCircleIcon /></template>
          <template #title>{{ t("common.error") }}</template>
          <template #default>{{ item.message }}</template>
        </Alert>
      </div>
    </TransitionGroup>

    <!-- 瞬时反馈：角落 inbox 堆叠，自动消退 -->
    <div class="inbox-layer">
      <TransitionGroup name="inbox" tag="div" class="inbox-stack">
        <div v-for="item in infoItems" :key="item.id" class="inbox-item">
          <Alert
            variant="error"
            dismissible
            floating
            class="inbox-alert"
            @close="dismissNotice(item.id)"
          >
            <template #icon><DangerCircleIcon /></template>
            <template #default>{{ item.message }}</template>
          </Alert>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"

import Alert from "@components/ui/alert/Alert.vue"
import { dismissNotice, noticeQueue } from "@components/layout/notify.js"
import { DangerCircleIcon } from "@components/icons/index.js"

const { t } = useI18n()
const actionItems = computed(() => noticeQueue.value.filter((n) => n.kind === "action"))
const infoItems = computed(() => noticeQueue.value.filter((n) => n.kind === "info"))
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
  gap: var(--spacing-xxs);
  padding: var(--spacing-xs) var(--spacing-md);
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

/* 角落 inbox：右下堆叠，滑入消退 */
.inbox-layer {
  position: fixed;
  inset-block-end: var(--spacing-md);
  inset-inline-end: var(--spacing-md);
  z-index: var(--z-modal);
  display: flex;
  width: min(22.5rem, calc(100vw - var(--spacing-xl)));
  pointer-events: none;
}

.inbox-stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
}

.inbox-item {
  position: relative;
  pointer-events: auto;
}

.inbox-alert {
  box-shadow: var(--shadow-elevated);
}

.inbox-enter-active,
.inbox-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-smooth),
    transform var(--duration-normal) var(--ease-smooth);
}

.inbox-enter-from,
.inbox-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
}

.inbox-move {
  transition: transform var(--duration-normal) var(--ease-smooth);
}

@media (prefers-reduced-motion: reduce) {
  .banner-enter-active,
  .banner-leave-active,
  .banner-move,
  .inbox-enter-active,
  .inbox-leave-active,
  .inbox-move {
    transition: none;
  }
}
</style>
