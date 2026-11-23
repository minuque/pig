<template>
  <ToastRegion
    class="toast-region"
    :toaster="noticeToaster"
    side="bottom"
    align="end"
    expanded
    :max-visible="Infinity"
    :aria-label="t('common.notifications')"
  >
    <template #default="{ toast }">
      <Toast class="toast-item">
        <ToastClose>
          <template #render="{ props }">
            <AsChildSlot :part-props="props">
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
            </AsChildSlot>
          </template>
        </ToastClose>

        <div class="toast-body">
          <div class="toast-head">
            <span class="toast-icon" :data-tone="LEVEL_TONE[noticeOf(toast).level]">
              <component :is="LEVEL_ICON[noticeOf(toast).level]" />
            </span>

            <ToastTitle class="toast-title">
              {{ headline(noticeOf(toast)) }}
            </ToastTitle>
          </div>

          <ToastDescription
            v-if="noticeOf(toast).title || noticeOf(toast).level === 'error'"
            class="toast-text"
            :data-clamp="noticeOf(toast).message.length > CLAMP_CHARS || undefined"
            :title="
              noticeOf(toast).message.length > CLAMP_CHARS ? noticeOf(toast).message : undefined
            "
          >
            {{ noticeOf(toast).message }}
          </ToastDescription>
        </div>

        <ToastAction v-if="noticeOf(toast).action">
          <template #render="{ props }">
            <AsChildSlot :part-props="props">
              <Button class="toast-action" size="s" variant="solid">
                <Undo2Icon v-if="noticeOf(toast).action?.icon === 'undo'" />
                <ArrowUpRightIcon v-else />
                {{ noticeOf(toast).action?.label }}
              </Button>
            </AsChildSlot>
          </template>
        </ToastAction>
      </Toast>
    </template>
  </ToastRegion>
</template>

<script setup lang="ts">
import type { Component } from "vue"
import { useEventListener } from "@vueuse/core"
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
} from "@ui-sdk/vue/toast"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { AsChildSlot } from "@components/ui/primitive/index.js"
import {
  noticeOf,
  noticeToaster,
  type Notice,
  type NoticeLevel,
} from "@components/layout/notify.js"
import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  CircleExclamationPointIcon,
  InfoIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "@components/icons/index.js"
import type { Tone } from "@/types/ui-type.js"

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
let pointerX = Number.NaN
let pointerY = Number.NaN

useEventListener(
  window,
  "pointermove",
  (event: PointerEvent) => {
    pointerX = event.clientX
    pointerY = event.clientY
  },
  { passive: true },
)

useEventListener(
  document,
  "pointerenter",
  (event: PointerEvent) => {
    if (
      event.target instanceof Element &&
      event.target.matches('[data-slot="toast-region"]') &&
      event.clientX === pointerX &&
      event.clientY === pointerY
    )
      event.stopPropagation()
  },
  { capture: true },
)

function headline(notice: Notice): string {
  return notice.title ?? (notice.level === "error" ? t("common.error") : notice.message)
}
</script>

<style>
.toast-region {
  inset: auto var(--space-md) var(--space-md) auto;
  inline-size: min(var(--toast-width), calc(100vw - 2 * var(--space-md)));
  margin: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  background: transparent;
  pointer-events: none;
  outline: none;
}

.toast-region [data-slot="toast-list"] {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-sm);
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
  translate: var(--toast-swipe-x, 0) var(--toast-swipe-y, 0);
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
  margin: 0;
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

@media (prefers-reduced-motion: no-preference) {
  .toast-item {
    transition:
      translate var(--duration-slow) var(--ease-out),
      opacity var(--duration-fast) var(--ease-out);
  }

  .toast-item[data-swiping] {
    transition: none;
  }

  .toast-item[data-starting-style] {
    opacity: 0;
    translate: calc(100% + var(--space-md)) 0;
  }

  .toast-item[data-ending-style] {
    opacity: 0;
    transition-duration: var(--duration-fast);
  }

  .toast-item[data-ending-style][data-swipe-direction="right"] {
    translate: calc(100% + var(--space-md)) 0;
  }

  .toast-item[data-ending-style][data-swipe-direction="down"] {
    translate: 0 calc(100% + var(--space-md));
  }
}
</style>
