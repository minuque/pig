<template>
  <Teleport to="body">
    <div class="alert-toaster" role="region" aria-label="通知">
      <TransitionGroup name="alert-toaster" tag="div" class="alert-toaster-stack">
        <div v-for="item in noticeQueue" :key="item.id" class="alert-toaster-item">
          <Alert :variant="item.variant" class="alert-toaster-alert">
            <component :is="noticeIcons[item.variant]" aria-hidden="true" />
            <AlertTitle v-if="item.title">{{ item.title }}</AlertTitle>
            <AlertDescription>{{ item.message }}</AlertDescription>
            <AlertAction v-if="item.action">
              <button class="alert-toaster-action" type="button" @click="runAction(item)">
                {{ item.action.label }}
              </button>
            </AlertAction>
          </Alert>
          <button
            class="alert-toaster-close"
            type="button"
            aria-label="关闭通知"
            @click="dismissNotice(item.id)"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-vue-next"
import Alert from "@components/ui/alert/Alert.vue"
import AlertAction from "@components/ui/alert/AlertAction.vue"
import AlertDescription from "@components/ui/alert/AlertDescription.vue"
import AlertTitle from "@components/ui/alert/AlertTitle.vue"
import {
  dismissNotice,
  noticeQueue,
  type Notice,
  type NoticeVariant,
} from "@components/ui/alert/notify.js"

const noticeIcons = {
  error: CircleAlert,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
} satisfies Record<NoticeVariant, typeof CircleAlert>

function runAction(item: Notice): void {
  dismissNotice(item.id)
  item.action?.onSelect()
}
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
.alert-toaster-alert {
  padding-right: var(--spacing-xl);
  box-shadow: var(--shadow-elevated);
}
.alert-toaster-action {
  min-height: 28px;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-sm);
  color: currentColor;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.alert-toaster-action:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.alert-toaster-close {
  position: absolute;
  top: -6px;
  right: -6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: var(--border-width) solid color-mix(in srgb, var(--ink) 10%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  color: var(--ink-muted);
  box-shadow: var(--shadow-soft);
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
}
.alert-toaster-close svg {
  width: 12px;
  height: 12px;
}
.alert-toaster-close:hover {
  background: var(--surface);
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
@media (prefers-reduced-motion: reduce) {
  .alert-toaster-enter-active,
  .alert-toaster-leave-active {
    transition: none;
  }
}
</style>
