<template>
  <Card class="file-panel" :aria-label="t('files.title')">
    <template #render="{ props: part }">
      <section v-bind="part">
        <header class="file-panel-head">
          <Tooltip>
            <TooltipTrigger>
              <template #render="{ props: part }">
                <IconButton
                  v-bind="part"
                  type="button"
                  size="s"
                  variant="ghost"
                  color="neutral"
                  :aria-label="t('files.toggleTree')"
                  :aria-pressed="pane.treeShown.value"
                  @click="pane.toggleTree"
                >
                  <PanelLeftIcon v-if="pane.treeShown.value" class="size-icon" />
                  <SquarePaddingLeftIcon v-else class="size-icon" />
                </IconButton>
              </template>
            </TooltipTrigger>

            <TooltipContent>{{ t("files.toggleTree") }}</TooltipContent>
          </Tooltip>

          <FileTabs class="file-panel-tabs" />

          <Tooltip>
            <TooltipTrigger>
              <template #render="{ props: part }">
                <IconButton
                  v-bind="part"
                  type="button"
                  size="s"
                  variant="ghost"
                  color="neutral"
                  :aria-label="t('files.search')"
                  @click="pane.focusSearch()"
                >
                  <SearchIcon class="size-icon" />
                </IconButton>
              </template>
            </TooltipTrigger>

            <TooltipContent>{{ t("files.search") }}</TooltipContent>
          </Tooltip>
        </header>

        <div class="file-panel-body">
          <Resizable
            v-if="pane.treeShown.value"
            auto-save-id="pig.files.tree"
            class="file-panel-split"
          >
            <ResizablePanel
              id="files-tree"
              :default-size="`${TREE_DEFAULT}px`"
              :min-size="`${TREE_MIN}px`"
              class="file-panel-col"
            >
              <FileSearch><FileTree /></FileSearch>
            </ResizablePanel>

            <ResizableHandle>
              <template #render="{ props: part }">
                <ResizeHandle v-bind="part" class="file-panel-handle" />
              </template>
            </ResizableHandle>

            <ResizablePanel id="files-viewer" :min-size="`${VIEWER_MIN}px`" class="file-panel-col">
              <FileViewer v-if="active" :key="active" :path="active" />
              <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
            </ResizablePanel>
          </Resizable>

          <FileViewer v-else-if="active" :key="active" :path="active" />
          <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
        </div>
      </section>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/vue/resizable"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { Card } from "@pig/ui/card"
import { ResizeHandle } from "@pig/ui/resize-handle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { PanelLeftIcon, SquarePaddingLeftIcon, SearchIcon } from "@components/icons/index.js"
import FileTabs from "@features/file-pane/components/FileTabs.vue"
import FileSearch from "@features/file-pane/components/FileSearch.vue"
import FileTree from "@features/file-pane/components/FileTree.vue"
import FileViewer from "@features/file-pane/components/FileViewer.vue"
import { useFilePane } from "@features/file-pane/index.js"

const TREE_DEFAULT = 240
const TREE_MIN = 160
const VIEWER_MIN = 200
const { t } = useI18n()
const pane = useFilePane()
const active = computed(() => pane.tabs.value.active)
</script>

<style scoped>
.file-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  padding: 0;
  background: var(--bg-surface);
}

.file-panel-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2xs);
  padding: var(--space-2xs) var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-subtle);
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

.file-panel-split {
  display: flex;
  flex: 1;
  min-block-size: 0;
}

.file-panel-col {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  min-block-size: 0;
}

.file-panel-handle {
  inline-size: var(--border-width);
  background: var(--border-subtle);
}

.file-panel-empty {
  display: grid;
  flex: 1;
  place-items: center;
  margin: 0;
  color: var(--fg-secondary);
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
