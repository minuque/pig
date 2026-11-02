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
          <div class="settings-right-head">
            <nav v-if="trail.length" class="settings-crumbs" :aria-label="t('settings.title')">
              <template v-for="(crumb, index) in trail" :key="`${index}-${crumb.label}`">
                <AltArrowRightIcon v-if="index > 0" class="crumb-sep" />

                <button v-if="crumb.action" type="button" class="crumb" @click="crumb.action()">
                  {{ crumb.label }}
                </button>

                <span
                  v-else
                  class="crumb"
                  :aria-current="index === trail.length - 1 ? 'page' : undefined"
                >
                  {{ crumb.label }}
                </span>
              </template>
            </nav>
          </div>

          <div ref="scroller" class="settings-scroll">
            <div class="settings-body">
              <GeneralPane v-if="active === 'general'" />
              <UsagePane v-else-if="active === 'usage'" />
              <ModelsPane v-else-if="active === 'models'" :refresh-models="refreshModels" />

              <ResourcePane
                v-else
                :pane="active === 'skills' ? 'skills' : 'extensions'"
                :cwd="cwd"
              />
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, provide, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import {
  AltArrowRightIcon,
  ChartSquareIcon,
  CloudIcon,
  SliderMinimalisticHorizontalIcon,
  Widget5Icon,
  WidgetAddIcon,
} from "@components/icons/index.js"
import GeneralPane from "./GeneralPane.vue"
import UsagePane from "./UsagePane.vue"
import ModelsPane from "./models/ModelsPane.vue"
import ResourcePane from "./ResourcePane.vue"

import type {
  SettingsCrumb,
  SettingsPane as Pane,
} from "@features/settings/hooks/use-settings-dialog.js"
import { SETTINGS_TRAIL } from "@features/settings/hooks/use-settings-dialog.js"

const props = defineProps<{
  open: boolean
  cwd?: string | undefined
  /** 打开时定位的分区，默认 General。 */
  initialPane?: Pane | undefined
  /** 刷新模型后同步 Composer 的模型目录。 */
  refreshModels?: (() => Promise<void>) | undefined
}>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const active = ref<Pane>(props.initialPane ?? "general")
const scroller = ref<HTMLElement>()
const trail = ref<SettingsCrumb[]>([])

provide(SETTINGS_TRAIL, trail)

const tabs = computed<{ id: Pane; label: string; icon: typeof SliderMinimalisticHorizontalIcon }[]>(
  () => [
    {
      id: "general",
      label: t("settings.general"),
      icon: SliderMinimalisticHorizontalIcon,
    },
    { id: "usage", label: t("settings.usage"), icon: ChartSquareIcon },
    { id: "models", label: t("settings.models.title"), icon: CloudIcon },
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

/** 每次打开回到 initialPane（默认 General），切分区回到顶部。 */
watch(
  () => props.open,
  async (open) => {
    if (!open) return

    active.value = props.initialPane ?? "general"
    await nextTick()
    resetScroll()
  },
)

/** 弹框已开时再次 openSettings 也要切到新分区。 */
watch(
  () => props.initialPane,
  (pane) => {
    if (props.open && pane) active.value = pane
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
  background: var(--background);
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
  display: flex;
  align-items: center;
  flex: none;
  height: calc(var(--space-md) + var(--size-icon-button) + var(--space-sm));
  padding-inline: var(--space-lg);
}

.settings-dialog .settings-crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: var(--size-settings-body);
  margin-inline: auto;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
}

.settings-dialog .crumb {
  color: inherit;
  font-size: inherit;
}

.settings-dialog button.crumb:hover {
  color: var(--contrast-foreground);
}

.settings-dialog .crumb[aria-current="page"] {
  color: var(--contrast-foreground);
}

.settings-dialog .crumb-sep {
  inline-size: 12px;
  block-size: 12px;
  color: var(--contrast-foreground-faint);
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
