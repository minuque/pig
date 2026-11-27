<template>
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ notificationAnnouncement }}
  </div>

  <div
    ref="layer"
    data-slot="notification-region"
    data-persistent-overlay
    :data-expanded="expanded || undefined"
    :aria-label="labels.notifications"
    :style="regionStyle"
    @pointerenter="onRegionEnter"
    @pointerleave="onRegionLeave"
    @focusin="expanded = true"
    @focusout="onFocusOut"
  >
    <div v-if="visible.length" class="notif-stack" @click.capture="onStackTap">
      <div
        v-for="(item, index) in visible"
        :key="item.id"
        :ref="(el) => bindCardEl(item.id, el)"
        class="notif-slot"
        :class="{
          'is-front': index === 0,
          'is-entering': enteringId === item.id,
          'is-dismissing': dismissingIds.has(item.id),
          'is-covered-pending': justArrived && index === 1,
          'is-swiping': swipe?.id === item.id,
        }"
        :style="cardStyle(item.id, index)"
        @pointerdown="onCardPointerDown(item.id, $event)"
        @pointermove="onCardPointerMove($event)"
        @pointerup="onCardPointerEnd"
        @pointercancel="onCardPointerEnd"
      >
        <NotificationCard
          :item="item"
          @close="dismissCard(item.id)"
          @action="runAction(item.id, $event)"
        >
          <template #avatar="slotProps">
            <slot name="avatar" v-bind="slotProps" />
          </template>
        </NotificationCard>
      </div>

      <Button
        v-if="expanded"
        type="button"
        size="s"
        variant="secondary"
        color="neutral"
        class="notif-clear-all"
        @click="clearAll"
      >
        {{ labels.clearAll }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
  type CSSProperties,
} from "vue"
import { useUiLabels } from "../../core/config.js"
import { useTopLayer } from "../../core/top-layer.js"
import { Button } from "../button/index.js"
import NotificationCard from "./NotificationCard.vue"
import {
  clearScreenNotifications,
  dismissNotificationScreen,
  notificationAnnouncement,
  screenNotifications,
  type NotificationAction,
} from "./store.js"

const MAX_VISIBLE = 3
const GAP_PX = 8
const SWIPE_THRESHOLD_PX = 72
const DISMISS_MS = 260
const ARRIVAL_COVER_MS = 320
const REDUCED_DISMISS_MS = 150

const labels = useUiLabels()
const layer = useTemplateRef<HTMLElement>("layer")
const expanded = shallowRef(false)
const heights = shallowRef<Record<string, number>>({})
const dismissingIds = shallowRef<ReadonlySet<string>>(new Set())
const enteringId = shallowRef<string>()
const justArrived = shallowRef(false)
const swipe = shallowRef<{ id: string; startX: number; startY: number; x: number } | null>(null)
const cardEls = new Map<string, HTMLElement>()
let observer: ResizeObserver | undefined
let arrivalTimer: ReturnType<typeof setTimeout> | undefined
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

const visible = computed(() => screenNotifications.value.slice(0, MAX_VISIBLE))

useTopLayer(layer, () => visible.value.length > 0)

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  )
}

function measureCard(id: string, el: HTMLElement) {
  const height = Math.round(el.getBoundingClientRect().height)

  if (height > 0 && heights.value[id] !== height) heights.value = { ...heights.value, [id]: height }
}

function ensureObserver() {
  if (observer || typeof ResizeObserver === "undefined") return observer
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const target = entry.target

      if (!(target instanceof HTMLElement)) continue

      for (const [id, el] of cardEls) {
        if (el === target) measureCard(id, el)
      }
    }
  })
  return observer
}

function bindCardEl(id: string, target: Element | ComponentPublicInstance | null) {
  const slotEl =
    target instanceof HTMLElement
      ? target
      : target && "$el" in target && target.$el instanceof HTMLElement
        ? target.$el
        : null
  const el = slotEl?.firstElementChild instanceof HTMLElement ? slotEl.firstElementChild : slotEl
  const prev = cardEls.get(id)

  if (prev === el) return

  if (prev) observer?.unobserve(prev)

  if (!el) {
    cardEls.delete(id)
    return
  }

  cardEls.set(id, el)
  ensureObserver()?.observe(el)
  measureCard(id, el)
}

watch(
  () => visible.value[0]?.id,
  (nextFront, prevFront) => {
    if (!nextFront || nextFront === prevFront) return

    clearTimeout(arrivalTimer)
    enteringId.value = nextFront
    justArrived.value = Boolean(prevFront)
    arrivalTimer = setTimeout(() => {
      enteringId.value = undefined
      justArrived.value = false
    }, ARRIVAL_COVER_MS)
  },
)

watch(
  () => visible.value.length,
  (count) => {
    if (count === 0) expanded.value = false
  },
)

const offsets = computed(() => {
  const list = visible.value
  const result: number[] = []
  let y = 0

  for (const item of list) {
    result.push(y)
    y += (heights.value[item.id] ?? 88) + GAP_PX
  }

  return result
})

const frontHeight = computed(() => {
  const front = visible.value[0]
  return front ? heights.value[front.id] : undefined
})

const stackHeight = computed(() => {
  const list = visible.value

  if (list.length === 0) return 0
  const last = list.at(-1)!
  const lastOffset = offsets.value[list.length - 1] ?? 0
  return lastOffset + (heights.value[last.id] ?? 88)
})

const regionStyle = computed<CSSProperties>(() => ({
  ...(frontHeight.value ? { "--notif-front-height": `${frontHeight.value}px` } : {}),
  "--notif-stack-height": `${stackHeight.value}px`,
}))

function cardStyle(id: string, index: number): CSSProperties {
  const offsetY = offsets.value[index] ?? 0
  const swipeX = swipe.value?.id === id ? `${swipe.value.x}px` : "0px"
  return {
    "--notif-index": String(index),
    "--notif-offset": `${offsetY}px`,
    "--notif-swipe-x": swipeX,
    zIndex: String(MAX_VISIBLE - index),
  } as CSSProperties
}

function onRegionEnter(event: PointerEvent) {
  if (event.pointerType === "mouse") expanded.value = true
}

function onRegionLeave(event: PointerEvent) {
  if (event.pointerType !== "mouse") return

  const active = layer.value?.ownerDocument.activeElement

  if (active && layer.value?.contains(active)) return
  expanded.value = false
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget

  if (next instanceof Node && layer.value?.contains(next)) return
  expanded.value = false
}

function onStackTap(event: MouseEvent) {
  if (expanded.value || visible.value.length <= 1) return

  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    event.stopPropagation()
    expanded.value = true
  }
}

function dismissCard(id: string) {
  if (dismissTimers.has(id)) return

  const next = new Set(dismissingIds.value)
  next.add(id)
  dismissingIds.value = next

  const wait = reducedMotion() ? REDUCED_DISMISS_MS : DISMISS_MS
  const timer = setTimeout(() => {
    dismissTimers.delete(id)
    const after = new Set(dismissingIds.value)
    after.delete(id)
    dismissingIds.value = after
    dismissNotificationScreen(id)
  }, wait)

  dismissTimers.set(id, timer)
}

function runAction(id: string, action: NotificationAction) {
  action.run()
  dismissNotificationScreen(id)
}

function clearAll() {
  expanded.value = false
  clearScreenNotifications()
}

function onCardPointerDown(id: string, event: PointerEvent) {
  if (event.pointerType !== "touch") return

  const target = event.target

  if (target instanceof Element && target.closest("button, a")) return
  swipe.value = { id, startX: event.clientX, startY: event.clientY, x: 0 }
}

function onCardPointerMove(event: PointerEvent) {
  const active = swipe.value

  if (!active || event.pointerType !== "touch") return

  const dx = Math.max(0, event.clientX - active.startX)
  const dy = Math.abs(event.clientY - active.startY)

  if (dx > dy) swipe.value = { ...active, x: dx }
}

function onCardPointerEnd() {
  const active = swipe.value

  if (!active) return
  swipe.value = null

  if (active.x >= SWIPE_THRESHOLD_PX) dismissCard(active.id)
}

onBeforeUnmount(() => {
  clearTimeout(arrivalTimer)

  for (const timer of dismissTimers.values()) clearTimeout(timer)
  dismissTimers.clear()
  observer?.disconnect()
  cardEls.clear()
})
</script>

<style>
:where([data-slot="notification-region"]) {
  position: fixed;
  inset-block-start: var(--notification-top);
  inset-inline-end: var(--notification-right);
  inset-inline-start: auto;
  inset-block-end: auto;
  inline-size: min(var(--notification-width), calc(100vw - 2 * var(--space-md)));
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  pointer-events: none;
  outline: none;
}

.notif-stack {
  position: relative;
  inline-size: 100%;
  min-block-size: var(--notif-front-height, auto);
}

:where([data-slot="notification-region"][data-expanded]) .notif-stack {
  min-block-size: var(--notif-stack-height);
}

.notif-slot {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  transform-origin: top center;
  translate: var(--notif-swipe-x, 0px) calc(var(--notif-index, 0) * var(--notif-peek));
  scale: calc(1 - var(--notif-index, 0) * 0.05);
  pointer-events: auto;
  transition:
    translate var(--duration-notif-settle) var(--ease-smooth),
    scale var(--duration-notif-settle) var(--ease-smooth),
    block-size var(--duration-notif-settle) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-out);
}

.notif-slot.is-swiping {
  transition: none;
}

.notif-slot:not(.is-front) {
  block-size: var(--notif-front-height, auto);
  overflow: hidden;
  border-radius: var(--radius-dialog);
}

.notif-slot:not(.is-front) .notif-card {
  box-shadow: var(--float-shadow);
}

.notif-slot:not(.is-front, .is-covered-pending) .notif-content,
.notif-slot:not(.is-front, .is-covered-pending) .notif-avatar,
.notif-slot:not(.is-front, .is-covered-pending) .notif-close {
  opacity: 0;
}

.notif-slot.is-front .notif-card {
  box-shadow: var(--shadow-popover);
}

:where([data-slot="notification-region"][data-expanded]) .notif-slot {
  translate: var(--notif-swipe-x, 0px) var(--notif-offset, 0px);
  scale: 1;
  block-size: auto;
  overflow: visible;
  transition:
    translate var(--duration-notif-expand) var(--ease-smooth),
    scale var(--duration-notif-expand) var(--ease-smooth),
    block-size var(--duration-notif-expand) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-out);
}

:where([data-slot="notification-region"][data-expanded]) .notif-slot .notif-card {
  box-shadow: var(--float-shadow);
}

:where([data-slot="notification-region"][data-expanded]) .notif-slot .notif-content,
:where([data-slot="notification-region"][data-expanded]) .notif-slot .notif-avatar {
  opacity: 1;
}

.notif-slot.is-entering {
  animation: notif-enter var(--duration-notif-enter) var(--ease-smooth);
}

.notif-slot.is-dismissing {
  pointer-events: none;
  animation: notif-dismiss var(--duration-notif-dismiss) ease-in forwards;
}

.notif-clear-all {
  position: absolute;
  inset-block-start: calc(var(--notif-stack-height) + var(--notif-gap));
  inset-inline-end: 0;
  pointer-events: auto;
  border-radius: var(--radius-control);
  box-shadow: var(--float-shadow);
}

@media (prefers-reduced-motion: reduce) {
  .notif-slot {
    transition: opacity var(--duration-fast) linear;
  }

  .notif-slot.is-entering,
  .notif-slot.is-dismissing {
    animation: none;
    transition: opacity var(--duration-fast) linear;
  }

  .notif-slot.is-dismissing {
    opacity: 0;
  }
}
</style>
