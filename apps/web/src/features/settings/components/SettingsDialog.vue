<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="settings-dialog" @interact-outside.prevent>
      <div class="settings-shell">
        <nav class="settings-nav" :aria-label="t('settings.title')">
          <DialogTitle class="settings-nav-title">{{ t("settings.title") }}</DialogTitle>

          <button
            v-for="item in tabs"
            :key="item.id"
            class="nav-item"
            :class="{ on: active === item.id }"
            type="button"
            :aria-current="active === item.id ? 'page' : undefined"
            @click="select(item.id)"
          >
            <component :is="item.icon" class="size-icon" />
            <span class="nav-label">{{ item.label }}</span>
          </button>
        </nav>

        <div class="settings-right">
          <div class="settings-right-head" aria-hidden="true"></div>

          <div ref="scroller" class="settings-scroll">
            <div class="settings-body">
              <GeneralPane v-if="active === 'general'" />
              <UsagePane v-else-if="active === 'usage'" />
              <ResourcePane v-else :pane="active === 'skills' ? 'skills' : 'extensions'" />
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import {
  ChartSquareIcon,
  SliderMinimalisticHorizontalIcon,
  Widget5Icon,
  WidgetAddIcon,
} from "@components/icons/index.js"
import GeneralPane from "./GeneralPane.vue"
import UsagePane from "./UsagePane.vue"
import ResourcePane from "./ResourcePane.vue"

type Pane = "general" | "usage" | "skills" | "extensions"

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const active = ref<Pane>("general")
const scroller = ref<HTMLElement>()
const tabs = computed<{ id: Pane; label: string; icon: typeof SliderMinimalisticHorizontalIcon }[]>(
  () => [
    {
      id: "general",
      label: t("settings.general"),
      icon: SliderMinimalisticHorizontalIcon,
    },
    { id: "usage", label: t("settings.usage"), icon: ChartSquareIcon },
    { id: "skills", label: t("settings.skills"), icon: WidgetAddIcon },
    { id: "extensions", label: t("settings.extensions"), icon: Widget5Icon },
  ],
)

function select(pane: Pane) {
  active.value = pane
}

function resetScroll() {
  scroller.value?.scrollTo({ top: 0 })
}

/** 每次打开回到 General，切分区回到顶部。 */
watch(
  () => props.open,
  async (open) => {
    if (!open) return

    active.value = "general"
    await nextTick()
    resetScroll()
  },
)

watch(active, async () => {
  await nextTick()
  resetScroll()
})
</script>

<style>
/* 内容经 Portal 挂到 body，scoped 打不中，选择器统一挂在 .settings-dialog 前缀下。 */
.settings-dialog {
  display: flex;
  width: min(88vw, var(--size-settings-dialog-width));
  max-width: min(88vw, var(--size-settings-dialog-width));
  height: clamp(var(--size-settings-dialog-height-min), 85vh, var(--size-settings-dialog-height));
  padding: 0;
  gap: 0;
}

.settings-dialog .settings-shell {
  display: flex;
  width: 100%;
  min-height: 0;
}

.settings-dialog .settings-nav {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-xxs);
  width: var(--size-settings-dialog-nav);
  padding: var(--space-md);
  padding-block-start: calc(var(--space-md) + var(--space-xxs));
  border-inline-end: var(--border-width) solid var(--sidebar-border);
  background: var(--sidebar);
  color: var(--sidebar-foreground);
  user-select: none;
}

.settings-dialog .settings-nav-title {
  margin: 0;
  margin-block-end: var(--space-sm);
  padding-inline: var(--space-xs);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
}

.settings-dialog .nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--space-xs);
  border-radius: var(--radius-md);
  color: var(--sidebar-foreground);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: start;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .nav-item:hover {
  background: var(--sidebar-hover);
}

.settings-dialog .nav-item.on {
  background: var(--sidebar-selected);
}

.settings-dialog .settings-right {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--background);
}

/* 头部条占住右上角关闭按钮的位置，滚动条从这里以下开始 */
.settings-dialog .settings-right-head {
  flex: none;
  height: calc(var(--space-md) + var(--size-icon-button) + var(--space-sm));
}

.settings-dialog .settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-lg);
  padding-block-start: var(--space-xxs);
}

.settings-dialog .settings-body {
  width: 100%;
  max-width: var(--size-settings-body);
  margin-inline: auto;
}

@media (max-width: 720px) {
  .settings-dialog .settings-nav {
    align-items: center;
    width: var(--size-settings-dialog-nav-narrow);
    padding-inline: var(--space-xxs);
  }

  .settings-dialog .settings-nav-title {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .settings-dialog .nav-label {
    display: none;
  }

  .settings-dialog .nav-item {
    justify-content: center;
    padding-inline: 0;
  }
}

@media (max-width: 639px) {
  .settings-dialog {
    width: 100%;
    max-width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-dialog .nav-item {
    transition: none;
  }
}
</style>
