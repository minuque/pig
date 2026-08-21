<template>
  <Teleport to="body">
    <div class="alert-toaster" role="region" aria-label="通知">
      <TransitionGroup name="alert-toaster" tag="div" class="alert-toaster-stack">
        <div v-for="item in noticeQueue" :key="item.id" class="alert-toaster-item">
          <Alert :variant="item.variant" class="pr-9">
            <CircleAlert v-if="item.variant === 'destructive'" />
            <AlertDescription>{{ item.message }}</AlertDescription>
          </Alert>
          <button
            class="alert-toaster-close"
            type="button"
            aria-label="关闭通知"
            @click="dismissNotice(item.id)"
          >
            <X :size="12" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CircleAlert, X } from "lucide-vue-next";
import Alert from "@components/ui/alert/Alert.vue";
import AlertDescription from "@components/ui/alert/AlertDescription.vue";
import { dismissNotice, noticeQueue } from "@components/ui/alert/notify.js";
</script>

<style scoped>
.alert-toaster {
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
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
.alert-toaster-close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}
.alert-toaster-close:hover {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
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
  top: calc(var(--titlebar-inset) + var(--spacing-xs));
}
html[data-pig-desktop-platform="win32"] .alert-toaster {
  right: calc(var(--size-windows-caption) + var(--spacing-xs));
}
</style>
