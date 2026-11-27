<template>
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ toastAnnouncement }}
  </div>

  <div
    ref="layer"
    data-slot="toast-region"
    data-persistent-overlay
    :aria-label="labels.notifications"
  >
    <Transition
      name="toast-pill"
      @enter="leaving = false"
      @before-leave="leaving = true"
      @after-leave="leaving = false"
    >
      <div
        v-if="activeToast"
        ref="pill"
        data-slot="toast"
        :data-kind="activeToast.kind"
        :data-tone="activeToast.tone"
        :data-has-action="Boolean(activeToast.action) || undefined"
        tabindex="-1"
        @pointerenter="pauseToast"
        @pointerleave="resumeToast"
        @focusin="pauseToast"
        @focusout="onFocusOut"
        @keydown.escape.stop="dismissToast()"
      >
        <div v-if="activeToast.sheen" :key="`sheen-${activeToast.seq}`" class="toast-sheen" />

        <div class="toast-stage">
          <Transition name="toast-morph">
            <div :key="activeToast.seq" class="toast-inner">
              <span data-slot="toast-icon" :data-tone="ICON_TONE[activeToast.tone]">
                <template v-if="activeToast.kind === 'action'">
                  <svg class="toast-ring" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="toast-ring-track" cx="12" cy="12" r="9" />
                    <circle
                      class="toast-ring-fill"
                      cx="12"
                      cy="12"
                      r="9"
                      :stroke-dasharray="RING_CIRCUMFERENCE"
                      :stroke-dashoffset="ringOffset"
                    />
                  </svg>
                  <span class="toast-countdown">{{ countdownSeconds }}</span>
                </template>

                <template v-else-if="activeToast.kind === 'progress'">
                  <svg class="toast-spinner" viewBox="0 0 24 24" aria-hidden="true">
                    <circle class="toast-ring-track" cx="12" cy="12" r="9" />
                    <circle
                      class="toast-spinner-arc"
                      cx="12"
                      cy="12"
                      r="9"
                      :stroke-dasharray="RING_CIRCUMFERENCE"
                      :stroke-dashoffset="RING_CIRCUMFERENCE * 0.72"
                    />
                  </svg>
                </template>

                <component :is="STATUS_ICON[activeToast.tone]" v-else class="toast-glyph" />
              </span>

              <span data-slot="toast-title">{{ activeToast.message }}</span>

              <Button
                v-if="activeToast.action"
                type="button"
                size="s"
                variant="ghost"
                color="accent"
                data-toast-action
                @click="triggerToastAction()"
              >
                <Undo2Icon v-if="activeToast.action.icon === 'undo'" class="size-icon-sm" />
                <RotateCcwIcon
                  v-else-if="activeToast.action.icon === 'retry'"
                  class="size-icon-sm"
                />
                <ArrowUpRightIcon v-else class="size-icon-sm" />
                {{ activeToast.action.label }}
              </Button>

              <IconButton
                v-if="activeToast.action"
                type="button"
                size="s"
                variant="ghost"
                color="neutral"
                data-toast-close
                :aria-label="labels.close"
                @click="dismissToast()"
              >
                <XIcon class="size-icon-sm" />
              </IconButton>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch, type Component } from "vue"
import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleExclamationPointIcon,
  InfoIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "@lucide/vue"
import { useUiLabels } from "../../core/config.js"
import { useTopLayer } from "../../core/top-layer.js"
import type { Tone } from "../../core/types.js"
import { Button, IconButton } from "../button/index.js"
import {
  activeToast,
  dismissToast,
  pauseToast,
  resumeToast,
  toastAnnouncement,
  toastDurationMs,
  toastRemainingMs,
  triggerToastAction,
  type ToastTone,
} from "./notify.js"

const RING_RADIUS = 9
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const ICON_TONE: Record<ToastTone, Tone> = {
  accent: "accent",
  success: "success",
  info: "info",
  warning: "warning",
  error: "danger",
}
const STATUS_ICON: Record<ToastTone, Component> = {
  accent: CheckIcon,
  success: CheckIcon,
  info: InfoIcon,
  warning: TriangleAlertIcon,
  error: CircleExclamationPointIcon,
}

const labels = useUiLabels()
const layer = useTemplateRef<HTMLElement>("layer")
const pill = useTemplateRef<HTMLElement>("pill")
const leaving = shallowRef(false)

useTopLayer(layer, () => Boolean(activeToast.value) || leaving.value)

const countdownSeconds = computed(() => Math.max(1, Math.ceil(toastRemainingMs.value / 1000)))
const ringOffset = computed(() => {
  const total = toastDurationMs.value

  if (!Number.isFinite(total) || total <= 0) return 0
  const elapsedRatio = Math.max(0, Math.min(1, 1 - toastRemainingMs.value / total))
  return RING_CIRCUMFERENCE * elapsedRatio
})

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget

  if (next instanceof Node && pill.value?.contains(next)) return
  resumeToast()
}

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  )
}

watch(
  () => activeToast.value?.seq,
  async (nextSeq, prevSeq) => {
    if (!nextSeq || !prevSeq || nextSeq === prevSeq || reducedMotion()) return
    const el = pill.value
    const fromWidth = el?.getBoundingClientRect().width

    if (!el || !fromWidth) return
    await nextTick()
    const toWidth = el.getBoundingClientRect().width

    if (!toWidth || Math.abs(fromWidth - toWidth) < 1) return

    el.animate?.([{ inlineSize: `${fromWidth}px` }, { inlineSize: `${toWidth}px` }], {
      duration: 380,
      easing: "cubic-bezier(0.32, 0.72, 0, 1)",
    })
  },
  { flush: "pre" },
)
</script>

<style>
:where([data-slot="toast-region"]) {
  position: fixed;
  inset-block-start: var(--toast-top);
  inset-inline-start: var(--toast-anchor-x);
  inset-inline-end: auto;
  inset-block-end: auto;
  transform: translateX(-50%);
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  pointer-events: none;
  outline: none;
}

:where([data-slot="toast"]) {
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  block-size: var(--toast-pill-height);
  max-inline-size: min(var(--toast-max-width), calc(100vw - 2 * var(--space-md)));
  padding-inline: var(--space-xs);
  border-radius: var(--toast-radius);
  background-color: var(--bg-raised);
  box-shadow: var(--toast-shadow);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  pointer-events: auto;
  user-select: none;
  overflow: hidden;
  outline: none;
}

:where([data-slot="toast"][data-has-action]) {
  padding-inline: var(--space-xs) 6px;
}

:where([data-slot="toast"]:focus-visible) {
  box-shadow: var(--focus-ring), var(--toast-shadow);
}

.toast-sheen {
  position: absolute;
  inset: 0;
  background-image: var(--toast-sheen);
  pointer-events: none;
  animation: toast-sheen var(--duration-toast-sheen) ease-out forwards;
}

.toast-stage {
  display: grid;
  grid-template: "content" auto / auto;
  align-items: center;
  min-inline-size: 0;
}

.toast-inner {
  grid-area: content;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
}

:where([data-slot="toast-icon"]) {
  position: relative;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--control-xs);
  block-size: var(--control-xs);
  border-radius: var(--radius-control);
  color: var(--tone-text);
  background-color: var(--tone-subtle);
}

:where([data-slot="toast-icon"][data-tone="accent"]) {
  background-color: var(--bg-selected);
}

:where([data-slot="toast"][data-kind="action"] [data-slot="toast-icon"]),
:where([data-slot="toast"][data-kind="progress"] [data-slot="toast-icon"]) {
  background-color: transparent;
}

.toast-glyph {
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

.toast-ring,
.toast-spinner {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
  transform: rotate(-90deg);
}

.toast-spinner {
  animation: toast-spin var(--duration-toast-sheen) linear infinite;
}

.toast-ring circle,
.toast-spinner circle {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
}

.toast-ring-track {
  stroke: var(--border-strong);
}

.toast-ring-fill {
  stroke: var(--accent-text);
  transition: stroke-dashoffset var(--duration-fast) linear;
}

.toast-spinner-arc {
  stroke: var(--info-solid);
}

.toast-countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--accent-text);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

:where([data-slot="toast-title"]) {
  min-inline-size: 0;
  overflow: hidden;
  padding-inline-end: var(--space-2xs);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where([data-slot="toast"] [data-toast-action]) {
  flex-shrink: 0;
  block-size: var(--control-sm);
  border-radius: var(--radius-control);
  color: var(--accent-text);
}

:where([data-slot="toast"] [data-toast-action]:is(:hover, :focus-visible)) {
  background-color: var(--bg-selected);
}

:where([data-slot="toast"] [data-toast-close]) {
  flex-shrink: 0;
  inline-size: var(--control-sm);
  block-size: var(--control-sm);
  border-radius: var(--radius-control);
  color: var(--fg-muted);
}

:where([data-slot="toast"] [data-toast-close]:is(:hover, :focus-visible)) {
  color: var(--fg);
}

.toast-pill-enter-active {
  animation: toast-enter var(--duration-toast-enter) var(--ease-toast-enter);
}

.toast-pill-leave-active {
  animation: toast-leave var(--duration-toast-leave) ease-in forwards;
}

.toast-morph-leave-active {
  position: relative;
  pointer-events: none;
  animation: toast-content-out var(--duration-toast-morph-out) ease-in forwards;
}

.toast-morph-enter-active {
  animation: toast-content-in var(--duration-slow) var(--ease-out) var(--duration-fast) both;
}

.toast-morph-enter-active [data-slot="toast-icon"] {
  animation: toast-icon-in var(--duration-toast-morph) var(--ease-out) var(--duration-fast) both;
}

@media (prefers-reduced-motion: reduce) {
  .toast-sheen,
  .toast-spinner,
  .toast-morph-enter-active [data-slot="toast-icon"] {
    animation: none;
  }

  .toast-sheen {
    display: none;
  }

  .toast-ring-fill {
    transition: none;
  }

  .toast-pill-enter-active,
  .toast-pill-leave-active,
  .toast-morph-enter-active,
  .toast-morph-leave-active {
    animation: none;
    transition: opacity var(--duration-fast) linear;
  }

  .toast-pill-enter-from,
  .toast-pill-leave-to,
  .toast-morph-enter-from,
  .toast-morph-leave-to {
    opacity: 0;
  }
}
</style>
