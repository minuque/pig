<template>
  <section class="file-panel" :aria-label="t('files.title')">
    <header class="file-panel-head">
      <Tooltip v-if="narrowCover">
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

      <!-- 右上角控制照 cc-wrapper：搜索、展开、关闭 -->
      <Tooltip v-for="action in actions" :key="action.key">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="action.label"
            :aria-pressed="action.pressed"
            @click="action.run"
          >
            <component :is="action.icon" class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ action.label }}</TooltipContent>
      </Tooltip>
    </header>

    <div class="file-panel-body">
      <!-- 树在左、查看器在右，中间可拖；没打开文件时右侧留空占位 -->
      <SplitterGroup
        v-if="pane.treeShown.value"
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
          <FileViewer v-if="active" :key="active" :path="active" />
          <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
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
  Maximize2Icon,
  Minimize2Icon,
  PanelLeftCloseIcon,
  PanelRightOpenIcon,
  SearchIcon,
  XIcon,
} from "@components/icons/index.js"
import FileTabs from "@features/file-pane/components/FileTabs.vue"
import FileSearch from "@features/file-pane/components/FileSearch.vue"
import FileTree from "@features/file-pane/components/FileTree.vue"
import FileViewer from "@features/file-pane/components/FileViewer.vue"
import { useFilePane } from "@features/file-pane/index.js"
import { usePanelHost } from "@features/split-view/index.js"

/** 树列宽照 cc-wrapper：默认 240，最窄 160；查看器至少留 200。 */
const TREE_DEFAULT = 240
const TREE_MIN = 160
const VIEWER_MIN = 200
/** covering：面板列盖住对话（窄屏或点了展开）。 */
const props = defineProps<{ covering?: boolean }>()
const { t } = useI18n()
const pane = useFilePane()
const host = usePanelHost()
const active = computed(() => pane.tabs.value.active)
const expanded = computed(() => host?.expanded.value ?? false)
/** 窄屏放不下才盖住：头部给返回按钮，不给展开与关闭。 */
const narrowCover = computed(() => props.covering && !expanded.value)
const actions = computed(() => [
  {
    key: "search",
    label: t("files.search"),
    icon: SearchIcon,
    pressed: undefined,
    run: () => void pane.focusSearch(),
  },
  ...(narrowCover.value || !host
    ? []
    : [
        {
          key: "expand",
          label: expanded.value ? t("common.collapse") : t("common.expand"),
          icon: expanded.value ? Minimize2Icon : Maximize2Icon,
          pressed: expanded.value,
          run: () => (host.expanded.value = !host.expanded.value),
        },
        {
          key: "close",
          label: t("common.close"),
          icon: XIcon,
          pressed: undefined,
          run: () => pane.setOpen(false),
        },
      ]),
])
</script>

<style scoped>
/* 与右侧面板同一外观：表面底，贴满面板列，分割线由面板列画 */
.file-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  overflow: hidden;
  background: var(--surface);
}

.file-panel-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xxs) var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-soft);
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
