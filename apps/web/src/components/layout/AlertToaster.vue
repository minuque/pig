<template>
  <Teleport to="body">
    <div class="alert-toaster">
      <TransitionGroup name="alert-toaster" tag="div" class="alert-toaster-stack">
        <div v-for="item in noticeQueue" :key="item.id" class="alert-toaster-item">
          <Alert
            variant="error"
            dismissible
            class="alert-toaster-alert"
            @close="dismissNotice(item.id)"
          >
            <template #icon><DangerCircleIcon /></template>
            <template #title>{{ t("common.error") }}</template>
            <template #default>{{ item.message }}</template>
          </Alert>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"

import Alert from "@components/ui/alert/Alert.vue"
import { dismissNotice, noticeQueue } from "@components/layout/notify.js"
import { DangerCircleIcon } from "@components/icons/index.js"

const { t } = useI18n()
</script>

<style scoped>
.alert-toaster {
  position: fixed;
  inset-block-start: calc(var(--size-control) + 3 * var(--spacing-xs));
  inset-inline-end: var(--spacing-md);
  z-index: var(--z-modal);
  display: flex;
  width: min(22.5rem, calc(100vw - var(--spacing-xl)));
  pointer-events: none;
}

.alert-toaster-stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
}

.alert-toaster-item {
  position: relative;
  pointer-events: auto;
}

.alert-toaster-alert {
  box-shadow: var(--shadow-elevated);
}

.alert-toaster-enter-active,
.alert-toaster-leave-active {
  transition:
    opacity var(--duration-normal) var(--ease-smooth),
    transform var(--duration-normal) var(--ease-smooth);
}

.alert-toaster-enter-from,
.alert-toaster-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

html[data-pig-desktop-platform] .alert-toaster {
  top: calc(var(--titlebar-inset) + var(--size-control) + 2 * var(--spacing-xs));
}

html[data-pig-desktop-platform="win32"] .alert-toaster {
  right: calc(var(--size-windows-caption) + var(--spacing-xs));
}

@media (prefers-reduced-motion: reduce) {
  .alert-toaster-enter-active,
  .alert-toaster-leave-active {
    transition: none;
  }
}
</style>
