<template>
  <ToastProvider swipe-direction="right" :label="t('common.notifications')">
    <ToastRoot
      v-for="item in noticeQueue"
      :key="item.id"
      class="toast-item"
      :open="item.open"
      :type="item.level === 'error' ? 'foreground' : 'background'"
      :duration="item.level === 'error' && !item.transient ? Infinity : PASSING_MS"
      @update:open="(open) => open || dismissNotice(item.id)"
    >
      <Banner
        variant="outline"
        color="neutral"
        size="m"
        dismissible
        floating
        class="toast-card"
        @close="dismissNotice(item.id)"
      >
        <template #icon>
          <span class="toast-icon" :data-tone="LEVEL_TONE[item.level]">
            <component :is="LEVEL_ICON[item.level]" />
          </span>
        </template>

        <template v-if="item.title || item.level === 'error'" #title>
          <ToastTitle class="toast-title">{{ item.title ?? t("common.error") }}</ToastTitle>
        </template>

        <ToastDescription class="toast-text" :title="item.message">
          {{ item.message }}
        </ToastDescription>

        <div v-if="item.action" class="toast-actions">
          <ToastAction as-child :alt-text="item.action.label">
            <Button size="s" variant="secondary" color="neutral" @click="item.action.run()">
              {{ item.action.label }}
            </Button>
          </ToastAction>
        </div>
      </Banner>
    </ToastRoot>

    <ToastPortal>
      <ToastViewport class="toast-viewport" />
    </ToastPortal>
  </ToastProvider>
</template>

<script setup lang="ts">
import type { Component } from "vue"
import {
  ToastAction,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { Banner } from "@components/ui/banner/index.js"
import { Button } from "@components/ui/button/index.js"
import { dismissNotice, noticeQueue, type NoticeLevel } from "@components/layout/notify.js"
import { BellIcon, CircleCheckIcon, CircleExclamationPointIcon } from "@components/icons/index.js"
import type { Tone } from "@/types/ui-type.js"

const PASSING_MS = 5_000
const { t } = useI18n()
const LEVEL_TONE: Record<NoticeLevel, Tone> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "danger",
}
const LEVEL_ICON: Record<NoticeLevel, Component> = {
  info: BellIcon,
  success: CircleCheckIcon,
  warning: CircleExclamationPointIcon,
  error: CircleExclamationPointIcon,
}
</script>

<style scoped>
.toast-card[data-slot="banner"] {
  padding-inline-end: var(--space-2xl);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-popover);
}

.toast-icon {
  display: flex;
  color: var(--tone-text);
}

.toast-icon svg {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}

.toast-title {
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.toast-text {
  display: -webkit-box;
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.toast-actions {
  display: flex;
  justify-content: flex-end;
  margin-block-start: var(--space-xs);
}
</style>

<style>
.toast-viewport {
  position: fixed;
  inset-block-end: var(--space-md);
  inset-inline-end: var(--space-md);
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  inline-size: min(var(--toast-width), calc(100vw - 2 * var(--space-md)));
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
  outline: none;
}

.toast-item {
  pointer-events: auto;
}

.toast-item[data-swipe="move"] {
  translate: var(--reka-toast-swipe-move-x) 0;
}

.toast-item[data-swipe="cancel"] {
  translate: 0 0;
  transition: translate var(--duration-fast) var(--ease-out);
}

@media (prefers-reduced-motion: no-preference) {
  .toast-item[data-state="open"] {
    animation: toast-in var(--duration-slow) var(--ease-out);
  }

  .toast-item[data-state="closed"] {
    animation: overlay-out var(--duration-fast) var(--ease-out) forwards;
  }

  .toast-item[data-swipe="end"] {
    animation: toast-swipe-out var(--duration-fast) var(--ease-out) forwards;
  }
}
</style>
