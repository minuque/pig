<template>
  <Popover v-model:open="open">
    <PopoverTrigger>
      <template #render="{ props: triggerProps }">
        <Tooltip>
          <TooltipTrigger>
            <template #render="{ props: tooltipProps }">
              <span class="bell-wrap">
                <IconButton
                  v-bind="{ ...tooltipProps, ...triggerProps }"
                  data-slot="notification-bell"
                  type="button"
                  size="m"
                  variant="ghost"
                  color="neutral"
                  :aria-label="bellAriaLabel"
                >
                  <BellIcon class="size-icon-lg" />
                </IconButton>

                <span v-if="unreadNotificationCount > 0" class="bell-badge" aria-hidden="true">
                  {{ badgeLabel }}
                </span>
              </span>
            </template>
          </TooltipTrigger>

          <TooltipContent>{{ labels.openNotifications }}</TooltipContent>
        </Tooltip>
      </template>
    </PopoverTrigger>

    <PopoverContent
      align="end"
      side="bottom"
      size="s"
      :max-width="'var(--notification-width)'"
      class="notif-popover"
    >
      <header class="notif-popover-head">
        <span class="notif-popover-title">{{ labels.notifications }}</span>

        <Button
          v-if="historyNotifications.length"
          type="button"
          size="s"
          variant="ghost"
          color="neutral"
          :disabled="!hasClearable"
          @click="clearNotificationHistory()"
        >
          {{ labels.clearAll }}
        </Button>
      </header>

      <div v-if="historyNotifications.length" class="notif-popover-list">
        <NotificationCard
          v-for="item in historyNotifications"
          :key="item.id"
          :item="item"
          flat
          @close="removeNotificationHistory(item.id)"
          @action="onAction(item.id, $event)"
        >
          <template #avatar="slotProps">
            <slot name="avatar" v-bind="slotProps" />
          </template>
        </NotificationCard>
      </div>

      <p v-else class="notif-popover-empty">{{ labels.notificationsEmpty }}</p>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { BellIcon } from "@lucide/vue"
import { useUiLabels } from "../../core/config.js"
import { Button, IconButton } from "../button/index.js"
import { Popover, PopoverContent, PopoverTrigger } from "../popover/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip/index.js"
import NotificationCard from "./NotificationCard.vue"
import {
  clearNotificationHistory,
  dismissNotificationScreen,
  historyNotifications,
  markNotificationsRead,
  removeNotificationHistory,
  unreadNotificationCount,
  type NotificationAction,
} from "./store.js"

const open = shallowRef(false)
const labels = useUiLabels()

const badgeLabel = computed(() =>
  unreadNotificationCount.value > 99 ? "99+" : String(unreadNotificationCount.value),
)

const bellAriaLabel = computed(() =>
  unreadNotificationCount.value > 0
    ? `${labels.value.openNotifications} (${unreadNotificationCount.value})`
    : labels.value.openNotifications,
)

const hasClearable = computed(() =>
  historyNotifications.value.some((item) => !(item.keepUntilResolved && !item.resolved)),
)

watch(open, (next) => {
  if (next) markNotificationsRead()
})

function onAction(id: string, action: NotificationAction) {
  open.value = false
  dismissNotificationScreen(id)
  action.run()
}
</script>

<style>
.bell-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.bell-badge {
  position: absolute;
  inset-block-start: 2px;
  inset-inline-end: 2px;
  display: grid;
  place-items: center;
  min-inline-size: var(--space-md);
  block-size: var(--space-md);
  padding-inline: var(--space-2xs);
  border-radius: var(--radius-pill);
  corner-shape: round;
  background-color: var(--accent-solid);
  color: var(--fg-on-accent);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  scale: 0.78;
  transform-origin: top right;
  pointer-events: none;
}

.notif-popover {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  inline-size: min(var(--notification-width), calc(100vw - 2 * var(--space-md)));
}

.notif-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  padding-inline: var(--space-2xs);
}

.notif-popover-title {
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.notif-popover-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-block-size: 400px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.notif-popover-empty {
  margin: 0;
  padding: var(--space-lg) var(--space-md);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  text-align: center;
}
</style>
