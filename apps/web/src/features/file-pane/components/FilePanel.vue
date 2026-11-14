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

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="t('files.toggleTree')"
            :aria-pressed="pane.treeShown.value"
            @click="pane.toggleTree"
          >
            <PanelLeftCloseIcon v-if="pane.treeShown.value" class="size-icon" />
            <PanelRightOpenIcon v-else class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("files.toggleTree") }}</TooltipContent>
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
      <!-- 没打开文件时树占满；打开后树在左、查看器在右，中间可拖 -->
      <FileSearch v-if="pane.treeShown.value && !active"><FileTree /></FileSearch>

      <SplitterGroup
        v-else-if="pane.treeShown.value && active"
        direction="horizontal"
        auto-save-id="pig.files.tree"
      >
        <SplitterPanel
          :default-size="TREE_DEFAULT"
          :min-size="TREE_MIN"
          size-unit="px"
          class="file-panel-col"
        >
          <FileSearch><FileTree /></FileSearch>
        </SplitterPanel>

        <SplitterResizeHandle class="file-panel-handle" />

        <SplitterPanel :min-size="VIEWER_MIN" size-unit="px" class="file-panel-col">
          <FileViewer :key="active" :path="active" />
        </SplitterPanel>
      </SplitterGroup>

      <FileViewer v-else-if="active" :key="active" :path="active" />
      <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import {
  ArrowLeftIcon,
  CloseIcon,
  PanelLeftCloseIcon,
  PanelRightOpenIcon,
} from "@components/icons/index.js"
import FileTabs from "@features/file-pane/components/FileTabs.vue"
import FileSearch from "@features/file-pane/components/FileSearch.vue"
import FileTree from "@features/file-pane/components/FileTree.vue"
import FileViewer from "@features/file-pane/components/FileViewer.vue"
import { useFilePane } from "@features/file-pane/index.js"

/** 树列宽照 cc-wrapper：默认 240，最窄 160；查看器至少留 200。 */
const TREE_DEFAULT = 240
const TREE_MIN = 160
const VIEWER_MIN = 200

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

.file-panel-col {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

/* 树与查看器之间：1px 分割线，两侧各留几像素的拖拽区 */
.file-panel-handle {
  position: relative;
  inline-size: 1px;
  background: var(--border-soft);
  cursor: col-resize;
}

.file-panel-handle::after {
  content: "";
  position: absolute;
  inset: 0 calc(-1 * var(--space-xxs));
}

.file-panel-handle:focus-visible {
  outline: var(--focus-ring);
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
