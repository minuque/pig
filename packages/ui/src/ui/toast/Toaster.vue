<template>
  <ToastRegion
    :toaster="noticeToaster"
    side="bottom"
    align="end"
    expanded
    :max-visible="Infinity"
    :aria-label="labels.notifications"
  >
    <template #default="{ toast }">
      <Toast>
        <ToastClose>
          <template #render="{ props }">
            <AsChildSlot :part-props="props">
              <IconButton
                data-toast-close
                type="button"
                size="s"
                variant="ghost"
                color="neutral"
                :aria-label="labels.close"
              >
                <XIcon class="size-icon" />
              </IconButton>
            </AsChildSlot>
          </template>
        </ToastClose>

        <div data-slot="toast-body">
          <div data-slot="toast-head">
            <span data-slot="toast-icon" :data-tone="LEVEL_TONE[noticeOf(toast).level]">
              <component :is="LEVEL_ICON[noticeOf(toast).level]" />
            </span>

            <ToastTitle>
              {{ headline(noticeOf(toast)) }}
            </ToastTitle>
          </div>

          <ToastDescription
            v-if="noticeOf(toast).title || noticeOf(toast).level === 'error'"
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
              <Button data-toast-action size="s" variant="solid">
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
import { onBeforeUnmount, onMounted, type Component } from "vue"
import {
  ArrowUpRightIcon,
  CircleCheckIcon,
  CircleExclamationPointIcon,
  InfoIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "@lucide/vue"
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
} from "@ui-sdk/vue/toast"
import { useUiLabels } from "../../core/config.js"
import type { Tone } from "../../core/types.js"
import { Button, IconButton } from "../button/index.js"
import { AsChildSlot } from "../primitive/index.js"
import { noticeOf, noticeToaster, type Notice, type NoticeLevel } from "./notify.js"

const CLAMP_CHARS = 180
const labels = useUiLabels()
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

function onPointerMove(event: PointerEvent) {
  pointerX = event.clientX
  pointerY = event.clientY
}

function onPointerEnter(event: PointerEvent) {
  if (
    event.target instanceof Element &&
    event.target.matches('[data-slot="toast-region"]') &&
    event.clientX === pointerX &&
    event.clientY === pointerY
  )
    event.stopPropagation()
}

onMounted(() => {
  window.addEventListener("pointermove", onPointerMove, { passive: true })
  document.addEventListener("pointerenter", onPointerEnter, { capture: true })
})

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onPointerMove)
  document.removeEventListener("pointerenter", onPointerEnter, { capture: true })
})

function headline(notice: Notice): string {
  return notice.title ?? (notice.level === "error" ? labels.value.error : notice.message)
}
</script>

<style>
:where([data-slot="toast-region"]) {
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

:where([data-slot="toast-region"] [data-slot="toast-list"]) {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-sm);
}

:where([data-slot="toast"]) {
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

:where([data-slot="toast-body"]) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

:where([data-slot="toast-head"]) {
  display: flex;
  gap: var(--space-xs);
  min-inline-size: 0;
}

:where([data-slot="toast-icon"]) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  block-size: calc(var(--text-body) * var(--text-body--line-height));
  color: var(--tone-text);
}

:where([data-slot="toast-icon"] svg) {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}

:where([data-slot="toast-title"]) {
  min-inline-size: 0;
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

:where([data-slot="toast-description"]) {
  min-inline-size: 0;
  margin: 0;
  color: var(--fg-secondary);
  overflow-wrap: anywhere;
  user-select: text;
}

:where([data-slot="toast-description"][data-clamp]) {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

:where([data-toast-action]) {
  flex-shrink: 0;
}

[data-slot="toast"] > [data-toast-close] {
  position: absolute;
  inset-block-start: var(--space-2xs);
  inset-inline-end: var(--space-2xs);
}

@media (prefers-reduced-motion: no-preference) {
  :where([data-slot="toast"]) {
    transition:
      translate var(--duration-slow) var(--ease-out),
      opacity var(--duration-fast) var(--ease-out);
  }

  :where([data-slot="toast"][data-swiping]) {
    transition: none;
  }

  :where([data-slot="toast"][data-starting-style]) {
    opacity: 0;
    translate: calc(100% + var(--space-md)) 0;
  }

  :where([data-slot="toast"][data-ending-style]) {
    opacity: 0;
    transition-duration: var(--duration-fast);
  }

  :where([data-slot="toast"][data-ending-style][data-swipe-direction="right"]) {
    translate: calc(100% + var(--space-md)) 0;
  }

  :where([data-slot="toast"][data-ending-style][data-swipe-direction="down"]) {
    translate: 0 calc(100% + var(--space-md));
  }
}
</style>
