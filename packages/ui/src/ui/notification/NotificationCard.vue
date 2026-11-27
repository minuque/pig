<template>
  <article
    :data-slot="flat ? 'notification-history-card' : 'notification-card'"
    class="notif-card"
    :class="{ 'is-flat': flat, 'is-unread': !item.read && !item.resolved }"
    :data-tone="CARD_TONE[item.tone]"
    tabindex="0"
    @keydown.escape.stop="emit('close')"
  >
    <IconButton
      v-if="!flat || !item.keepUntilResolved || item.resolved"
      type="button"
      size="s"
      variant="ghost"
      color="neutral"
      class="notif-close"
      :aria-label="labels.dismiss"
      @click.stop="emit('close')"
    >
      <XIcon class="size-icon-sm" />
    </IconButton>

    <div class="notif-avatar" :data-tone="CARD_TONE[item.tone]">
      <slot v-if="$slots.avatar && item.avatar" name="avatar" :item="item" />

      <component :is="TONE_ICON[item.tone]" v-else class="size-icon-lg" aria-hidden="true" />
    </div>

    <div class="notif-content">
      <header class="notif-head">
        <span class="notif-title">{{ item.title }}</span>
        <span class="notif-time">{{ timeLabel }}</span>
      </header>

      <p v-if="item.body" class="notif-body">{{ item.body }}</p>

      <div v-if="orderedActions.length" class="notif-actions">
        <Button
          v-for="action in orderedActions"
          :key="action.label"
          type="button"
          size="m"
          :variant="action.primary ? 'solid' : 'secondary'"
          :color="action.primary ? 'accent' : 'neutral'"
          class="notif-action-btn"
          @click.stop="emit('action', action)"
        >
          {{ action.label }}
        </Button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, type Component } from "vue"
import {
  BellIcon,
  CircleCheckIcon,
  CircleExclamationPointIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "@lucide/vue"
import { useUiLabels } from "../../core/config.js"
import type { Tone } from "../../core/types.js"
import { Button, IconButton } from "../button/index.js"
import type { NotificationAction, NotificationItem, NotificationTone } from "./store.js"

const CARD_TONE: Record<NotificationTone, Tone> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  error: "danger",
}
const TONE_ICON: Record<NotificationTone, Component> = {
  neutral: BellIcon,
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleExclamationPointIcon,
}

const props = withDefaults(
  defineProps<{
    item: NotificationItem
    flat?: boolean
  }>(),
  { flat: false },
)
const emit = defineEmits<{
  close: []
  action: [action: NotificationAction]
}>()

const labels = useUiLabels()
const now = shallowRef(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 30_000)
})

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
})

const orderedActions = computed(() => {
  const list = props.item.actions ?? []
  const secondary = list.filter((action) => !action.primary)
  const primary = list.filter((action) => action.primary)
  return [...secondary, ...primary].slice(0, 2)
})

const timeLabel = computed(() => {
  const diffMs = Math.max(0, now.value - props.item.createdAt)

  if (diffMs < 45_000) return labels.value.justNow

  const lang =
    typeof document !== "undefined" ? document.documentElement.lang || undefined : undefined
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "always", style: "narrow" })
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 60) return rtf.format(-minutes, "minute")

  const hours = Math.floor(minutes / 60)

  if (hours < 24) return rtf.format(-hours, "hour")
  return rtf.format(-Math.floor(hours / 24), "day")
})
</script>

<style>
.notif-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-dialog);
  background-color: var(--float-bg);
  backdrop-filter: var(--glass-filter);
  border: var(--border-width) solid var(--border);
  box-shadow: var(--float-shadow);
  color: var(--fg);
  outline: none;
  user-select: none;
}

.notif-card.is-flat {
  border-radius: var(--radius-card);
  background-color: var(--bg-surface);
  backdrop-filter: none;
  box-shadow: none;
}

.notif-card.is-flat.is-unread {
  border-color: var(--border-strong);
  background-color: var(--bg-raised);
}

.notif-card:focus-visible {
  box-shadow: var(--focus-ring), var(--float-shadow);
}

.notif-close {
  position: absolute;
  inset-block-start: calc(-1 * var(--space-xs));
  inset-inline-start: calc(-1 * var(--space-xs));
  z-index: var(--z-raise);
  inline-size: var(--control-xs);
  block-size: var(--control-xs);
  border-radius: var(--radius-control);
  background-color: var(--bg-raised);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--border-strong),
    var(--control-shadow);
  color: var(--fg-secondary);
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.notif-card.is-flat .notif-close {
  inset-block-start: var(--space-xs);
  inset-inline-start: auto;
  inset-inline-end: var(--space-xs);
  background-color: transparent;
  box-shadow: none;
}

.notif-card:hover .notif-close,
.notif-card:focus-within .notif-close,
.notif-close:focus-visible {
  opacity: 1;
}

.notif-close:hover {
  color: var(--fg);
}

.notif-avatar {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
  overflow: hidden;
  border-radius: var(--radius-control);
  background-color: var(--tone-subtle);
  color: var(--tone-text);
}

.notif-avatar > svg {
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
}

.notif-avatar > [data-slot="badge"] {
  inline-size: 100%;
  block-size: 100%;
  justify-content: center;
  border-radius: inherit;
}

.notif-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2xs);
  min-inline-size: 0;
}

.notif-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
  min-inline-size: 0;
}

.notif-card.is-flat .notif-head {
  padding-inline-end: var(--control-xs);
}

.notif-title {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif-time {
  flex-shrink: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.notif-body {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  overflow-wrap: anywhere;
  user-select: text;
}

.notif-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  margin-block-start: var(--space-xs);
}

.notif-action-btn {
  border-radius: var(--radius-control);
}

@media (pointer: coarse) {
  .notif-close {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .notif-close {
    transition: none;
  }
}
</style>
