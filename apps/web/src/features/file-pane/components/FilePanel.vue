<template>
  <section class="file-panel" :aria-label="t('files.title')">
    <header class="file-panel-head">
      <Tooltip v-if="covering">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="t('files.back')"
            @click="pane.setOpen(false)"
          >
            <ArrowLeftIcon class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("files.back") }}</TooltipContent>
      </Tooltip>

      <FileTabs class="file-panel-tabs" />

      <Tooltip v-if="!covering">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="t('common.close')"
            @click="pane.setOpen(false)"
          >
            <CloseIcon class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("common.close") }}</TooltipContent>
      </Tooltip>
    </header>

    <div class="file-panel-body">
      <FileViewer v-if="active" :key="active" :path="active" />
      <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { ArrowLeftIcon, CloseIcon } from "@components/icons/index.js"
import FileTabs from "@features/file-pane/components/FileTabs.vue"
import FileViewer from "@features/file-pane/components/FileViewer.vue"
import { useFilePane } from "@features/file-pane/index.js"

/** covering：窄屏盖住对话，头部给返回按钮代替关闭。 */
defineProps<{ covering?: boolean }>()

const { t } = useI18n()
const pane = useFilePane()
const active = computed(() => pane.tabs.value.active)
</script>

<style scoped>
/* 与右侧面板同一外观：表面底、卡片圆角、1px 柔描边 */
.file-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  overflow: hidden;
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 1px var(--border-soft);
}

.file-panel-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xxs) var(--space-xs);
  padding-inline-end: calc(var(--space-xs) + var(--titlebar-controls-inset));
}

.file-panel-tabs {
  flex: 1;
  min-inline-size: 0;
}

.file-panel-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}

.file-panel-empty {
  display: grid;
  flex: 1;
  place-items: center;
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
}

html[data-pig-desktop-platform] .file-panel-head {
  -webkit-app-region: drag;
  app-region: drag;
  user-select: none;
}

html[data-pig-desktop-platform] .file-panel-head :deep(:is(button, [role="tab"])) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>
