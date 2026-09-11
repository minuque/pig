<template>
  <Teleport to="body">
    <div class="alert-toaster">
      <TransitionGroup name="alert-toaster" tag="div" class="alert-toaster-stack">
        <div v-for="item in noticeQueue" :key="item.id" class="alert-toaster-item">
          <Alert variant="error" class="alert-toaster-alert">
            <CircleAlert />
            <AlertDescription>{{ item.message }}</AlertDescription>
          </Alert>
          <button class="alert-toaster-close" type="button" @click="dismissNotice(item.id)">
            <X class="size-icon" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CircleAlert, X } from "@lucide/vue"

import Alert from "@components/ui/alert/Alert.vue"
import AlertDescription from "@components/ui/alert/AlertDescription.vue"
import { dismissNotice, noticeQueue } from "@components/ui/alert/notify.js"
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
  padding-inline-end: var(--spacing-xl);
  box-shadow: var(--shadow-elevated);
}

.alert-toaster-close {
  position: absolute;
  inset-block-start: var(--spacing-xs);
  inset-inline-end: var(--spacing-xs);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: var(--spacing-xxs);
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-muted);
}
.alert-toaster-close:hover {
  color: var(--ink);
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
