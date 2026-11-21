<template>
  <ToastProvider swipe-direction="right" :label="t('common.notifications')">
    <ToastRoot
      v-for="item in noticeQueue"
      :key="item.id"
      class="toast-item"
      :open="item.open"
      :data-level="item.level"
      :type="item.level === 'error' ? 'foreground' : 'background'"
      :duration="item.level === 'error' && !item.transient ? Infinity : PASSING_MS"
      @update:open="(open) => open || dismissNotice(item.id)"
    >
      <ToastClose as-child>
        <IconButton
          class="toast-close"
          type="button"
          size="s"
          variant="ghost"
          color="neutral"
          :aria-label="t('common.close')"
        >
          <XIcon class="size-icon" />
        </IconButton>
      </ToastClose>

      <div class="toast-body">
        <div class="toast-head">
          <span class="toast-icon" :data-tone="LEVEL_TONE[item.level]">
            <component :is="LEVEL_ICON[item.level]" />
          </span>

          <ToastTitle class="toast-title">
            {{ item.title ?? (item.level === "error" ? t("common.error") : item.message) }}
          </ToastTitle>
        </div>

        <ToastDescription
          v-if="item.title || item.level === 'error'"
          class="toast-text"
          :data-clamp="item.message.length > CLAMP_CHARS || undefined"
          :title="item.message.length > CLAMP_CHARS ? item.message : undefined"
        >
          {{ item.message }}
        </ToastDescription>
      </div>

      <ToastAction v-if="item.action" as-child :alt-text="item.action.label">
        <Button class="toast-action" size="s" variant="solid" @click="item.action.run()">
          <ArrowUpRightIcon />
          {{ item.action.label }}
        </Button>
      </ToastAction>
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
  ToastClose,
  ToastDescription,
  ToastPortal,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { dismissNotice, noticeQueue, type NoticeLevel } from "@components/layout/notify.js"
import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  CircleExclamationPointIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "@components/icons/index.js"
import type { Tone } from "@/types/ui-type.js"

const PASSING_MS = 5_000
const CLAMP_CHARS = 180
const { t } = useI18n()
const LEVEL_TONE: Record<NoticeLevel, Tone> = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "danger",
}
const LEVEL_ICON: Record<NoticeLevel, Component> = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleExclamationPointIcon,
}
</script>

<style>
.toast-viewport {
  position: fixed;
  inset-block-end: var(--space-md);
  inset-inline-end: var(--space-md);
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  inline-size: min(var(--toast-width), calc(100vw - 2 * var(--space-md)));
  margin: 0;
  padding: 0;
  list-style: none;
  pointer-events: none;
  outline: none;
}

.toast-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) calc(var(--space-lg) + var(--space-xs)) var(--space-sm)
    calc(var(--space-sm) + 2px);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  background-color: var(--float-bg);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-card);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  pointer-events: auto;
  user-select: none;
}

.toast-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.toast-head {
  display: flex;
  gap: var(--space-xs);
  min-inline-size: 0;
}

.toast-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  block-size: calc(var(--text-body) * var(--text-body--line-height));
  color: var(--tone-text);
}

.toast-icon svg {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}

.toast-title {
  min-inline-size: 0;
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

.toast-text {
  min-inline-size: 0;
  color: var(--fg-secondary);
  overflow-wrap: anywhere;
  user-select: text;
}

.toast-text[data-clamp] {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.toast-action {
  flex-shrink: 0;
}

.toast-item .toast-close {
  position: absolute;
  inset-block-start: var(--space-2xs);
  inset-inline-end: var(--space-2xs);
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
