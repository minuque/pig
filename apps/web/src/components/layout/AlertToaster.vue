<template>
  <Teleport to="body">
    <!-- 需行动/需知悉：顶部 banner 层；包 ThemeRoot 才拿得到 rt 的间距、圆角与配色 token -->
    <ThemeRoot>
      <TransitionGroup name="banner" tag="div" class="banner-layer">
        <div v-for="item in noticeQueue" :key="item.id" class="banner-item">
          <Banner
            variant="surface"
            size="s"
            :color="LEVEL_COLOR[item.level]"
            dismissible
            floating
            class="banner-alert"
            @close="dismissNotice(item.id)"
          >
            <template v-if="item.level === 'error'" #icon><CircleExclamationPointIcon /></template>
            <template v-if="item.level === 'error'" #title>{{ t("common.error") }}</template>
            <template #default>{{ item.message }}</template>
          </Banner>
        </div>
      </TransitionGroup>
    </ThemeRoot>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"

import { Banner, type BannerColor } from "@components/ui/banner/index.js"
import ThemeRoot from "@components/ui/rt/ThemeRoot.vue"
import { dismissNotice, noticeQueue, type NoticeLevel } from "@components/layout/notify.js"
import { CircleExclamationPointIcon } from "@components/icons/index.js"

const { t } = useI18n()
const LEVEL_COLOR: Record<NoticeLevel, BannerColor> = {
  info: "info",
  warning: "warning",
  error: "destructive",
}
</script>

<style scoped>
/* 顶部 banner：居中、宽度随窗口伸缩，从顶下滑；让开卡片头 */
.banner-layer {
  position: fixed;
  inset-block-start: var(--header-height);
  inset-inline: 0;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2xs);
  padding: var(--space-xs) var(--space-md);
  pointer-events: none;
}

.banner-item {
  inline-size: min(100%, var(--banner-width));
  pointer-events: auto;
}

.banner-alert {
  box-shadow: var(--shadow-popover);
}

.banner-enter-active,
.banner-leave-active {
  transition:
    opacity var(--duration-slow) var(--ease-out),
    transform var(--duration-slow) var(--ease-out);
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.banner-move {
  transition: transform var(--duration-slow) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .banner-enter-active,
  .banner-leave-active,
  .banner-move {
    transition: none;
  }
}
</style>
