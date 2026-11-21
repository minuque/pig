<template>
  <ToastProvider swipe-direction="up" :label="t('common.notifications')">
    <ToastRoot
      v-for="item in noticeQueue"
      :key="item.id"
      class="banner-item"
      :open="item.open"
      :type="item.level === 'error' ? 'foreground' : 'background'"
      :duration="item.level === 'error' && !item.transient ? Infinity : PASSING_MS"
      @update:open="(open) => open || dismissNotice(item.id)"
    >
      <Banner
        variant="soft"
        size="s"
        :color="LEVEL_COLOR[item.level]"
        dismissible
        floating
        class="banner-alert"
        @close="dismissNotice(item.id)"
      >
        <template v-if="item.level === 'error'" #icon><CircleExclamationPointIcon /></template>

        <template v-if="item.title || item.level === 'error'" #title>
          <ToastTitle>{{ item.title ?? t("common.error") }}</ToastTitle>
        </template>

        <div class="banner-row">
          <ToastDescription class="banner-text">{{ item.message }}</ToastDescription>

          <ToastAction v-if="item.action" as-child :alt-text="item.action.label">
            <Button size="s" variant="secondary" color="neutral" @click="item.action.run()">
              {{ item.action.label }}
            </Button>
          </ToastAction>
        </div>
      </Banner>
    </ToastRoot>

    <ToastViewport class="banner-layer" />
  </ToastProvider>
</template>

<script setup lang="ts">
import {
  ToastAction,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { Banner, type BannerColor } from "@components/ui/banner/index.js"
import { Button } from "@components/ui/button/index.js"
import { dismissNotice, noticeQueue, type NoticeLevel } from "@components/layout/notify.js"
import { CircleExclamationPointIcon } from "@components/icons/index.js"

const PASSING_MS = 5_000
const { t } = useI18n()
const LEVEL_COLOR: Record<NoticeLevel, BannerColor> = {
  info: "info",
  warning: "warning",
  error: "destructive",
}
</script>

<style scoped>
.banner-layer {
  position: fixed;
  inset-block-start: var(--header-height);
  inset-inline: 0;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2xs);
  margin: 0;
  padding: var(--space-xs) var(--space-md);
  list-style: none;
  pointer-events: none;
  outline: none;
}

.banner-item {
  inline-size: min(100%, var(--banner-width));
  pointer-events: auto;
}

.banner-item[data-swipe="move"] {
  transform: translateY(var(--reka-toast-swipe-move-y));
}

.banner-item[data-swipe="cancel"] {
  transform: translateY(0);
  transition: transform var(--duration-fast) var(--ease-out);
}

.banner-alert {
  background-image: linear-gradient(var(--tone-subtle), var(--tone-subtle));
  box-shadow: var(--shadow-popover);
}

.banner-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.banner-text {
  flex: 1;
  min-inline-size: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .banner-item[data-state="open"] {
    animation: settle-down var(--duration-normal) var(--ease-out);
  }

  .banner-item[data-state="closed"] {
    animation: overlay-out var(--duration-fast) var(--ease-out) forwards;
  }
}
</style>
