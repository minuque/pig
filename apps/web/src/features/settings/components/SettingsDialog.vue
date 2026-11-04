<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="settings-dialog" :show-close-button="false" @interact-outside.prevent>
      <DialogTitle class="sr-only">{{ t("settings.title") }}</DialogTitle>

      <div class="settings-shell">
        <nav class="settings-nav" :aria-label="t('settings.title')">
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
          <header class="settings-head">
            <nav class="settings-crumbs" :aria-label="t('settings.title')">
              <template v-for="(crumb, index) in crumbs" :key="`${index}-${crumb.label}`">
                <span v-if="index > 0" class="crumb-sep" aria-hidden="true">/</span>

                <button v-if="crumb.action" type="button" class="crumb" @click="crumb.action()">
                  {{ crumb.label }}
                </button>

                <span
                  v-else
                  class="crumb"
                  :aria-current="index === crumbs.length - 1 ? 'page' : undefined"
                >
                  {{ crumb.label }}
                </span>
              </template>
            </nav>

            <DialogClose class="settings-close" :aria-label="t('common.close')">
              <CloseIcon class="size-icon" />
            </DialogClose>
          </header>

          <div ref="scroller" class="settings-scroll">
            <div class="settings-body">
              <GeneralPane v-if="active === 'general'" />
              <ModelsPane v-else :refresh-models="refreshModels" />
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
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import { CloseIcon, CloudIcon, SliderMinimalisticHorizontalIcon } from "@components/icons/index.js"
import GeneralPane from "./GeneralPane.vue"
import ModelsPane from "./models/ModelsPane.vue"

import type {
  SettingsCrumb,
  SettingsPane as Pane,
} from "@features/settings/hooks/use-settings-dialog.js"
import { SETTINGS_TRAIL } from "@features/settings/hooks/use-settings-dialog.js"

const props = defineProps<{
  open: boolean
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
    { id: "models", label: t("settings.models.title"), icon: CloudIcon },
  ],
)
/** 头部路径：设置 + 分区自己的下钻层级，没有下钻就落到当前分区名。 */
const crumbs = computed<SettingsCrumb[]>(() => {
  const base: SettingsCrumb[] = [{ label: t("settings.title") }]
  const items = trail.value.length
    ? trail.value
    : [{ label: tabs.value.find((item) => item.id === active.value)?.label ?? "" }]
  return [...base, ...items]
})

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
  border-radius: var(--radius-xl);
  overflow: hidden;
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
  padding: var(--space-sm) var(--space-xs);
  border-inline-end: var(--border-width) solid var(--border-subtle);
  background: var(--background);
  user-select: none;
}

.settings-dialog .nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 2rem;
  padding-inline: var(--space-xs);
  border-radius: var(--radius-md);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
  text-align: start;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .nav-item:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.settings-dialog .nav-item.on {
  background: var(--sidebar-selected);
  color: var(--contrast-foreground);
}

.settings-dialog .settings-right {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--card);
}

.settings-dialog .settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  gap: var(--space-xs);
  height: 3rem;
  padding-inline: calc(var(--space-md) + var(--space-xxs)) var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.settings-dialog .settings-crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-sm);
}

.settings-dialog .crumb {
  overflow: hidden;
  color: inherit;
  font-size: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-dialog button.crumb:hover {
  color: var(--contrast-foreground);
}

.settings-dialog .crumb[aria-current="page"] {
  color: var(--contrast-foreground);
}

.settings-dialog .crumb-sep {
  color: var(--contrast-foreground-faint);
  user-select: none;
}

.settings-dialog .settings-close {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  border-radius: var(--radius-sm);
  color: var(--contrast-foreground-muted);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .settings-close:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.settings-dialog .settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-lg) var(--space-lg) calc(var(--space-xxl) + var(--space-md));
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
  .settings-dialog .nav-item,
  .settings-dialog .settings-close {
    transition: none;
  }
}
</style>
