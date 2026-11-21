<template>
  <Card as="section" class="file-panel" :aria-label="t('files.title')">
    <header class="file-panel-head">
      <Tooltip v-if="narrowCover">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="neutral"
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
            color="neutral"
            :aria-label="t('files.toggleTree')"
            :aria-pressed="pane.treeShown.value"
            @click="pane.toggleTree"
          >
            <PanelLeftIcon v-if="pane.treeShown.value" class="size-icon" />
            <PanelRightOpenIcon v-else class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("files.toggleTree") }}</TooltipContent>
      </Tooltip>

      <FileTabs class="file-panel-tabs" />

      <Tooltip v-for="action in actions" :key="action.key">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="neutral"
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

    <div ref="body" class="file-panel-body">
      <div v-if="pane.treeShown.value" class="file-panel-split">
        <div class="file-panel-col" :style="{ inlineSize: `${treeWidth}px` }">
          <FileSearch><FileTree /></FileSearch>
        </div>

        <ResizeHandle
          class="file-panel-handle"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          data-orientation="horizontal"
          :data-state="dragging ? 'drag' : undefined"
          @pointerdown="startDrag"
          @keydown.left.prevent="setTree(treeWidth - 16, true)"
          @keydown.right.prevent="setTree(treeWidth + 16, true)"
        />

        <div class="file-panel-col file-panel-viewer">
          <FileViewer v-if="active" :key="active" :path="active" />
          <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
        </div>
      </div>

      <FileViewer v-else-if="active" :key="active" :path="active" />
      <p v-else class="file-panel-empty">{{ t("files.empty") }}</p>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue"
import { useResizeObserver } from "@vueuse/core"
import { readPref, writePref } from "@utils/storage.js"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Card } from "@components/ui/card/index.js"
import { ResizeHandle, dragResize } from "@components/ui/resize-handle/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import {
  ArrowLeftIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelLeftIcon,
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

const TREE_DEFAULT = 240
const TREE_MIN = 160
const VIEWER_MIN = 200
const props = defineProps<{ covering?: boolean }>()
const { t } = useI18n()
const pane = useFilePane()
const host = usePanelHost()
const active = computed(() => pane.tabs.value.active)
const expanded = computed(() => host?.expanded.value ?? false)
const narrowCover = computed(() => props.covering && !expanded.value)
const TREE_WIDTH_KEY = "pig.files.treeWidth"
const savedTree = Number(readPref(TREE_WIDTH_KEY))
const treePref = shallowRef(Number.isFinite(savedTree) && savedTree > 0 ? savedTree : TREE_DEFAULT)
const bodyWidth = shallowRef(Number.POSITIVE_INFINITY)
const treeMax = computed(() => Math.max(TREE_MIN, bodyWidth.value - VIEWER_MIN))
const treeWidth = computed(() => Math.min(Math.max(treePref.value, TREE_MIN), treeMax.value))
const dragging = shallowRef(false)

useResizeObserver(useTemplateRef("body"), ([entry]) => {
  if (entry) bodyWidth.value = entry.contentRect.width
})

function setTree(next: number, save = false) {
  treePref.value = Math.min(Math.max(next, TREE_MIN), treeMax.value)

  if (save) writePref(TREE_WIDTH_KEY, String(Math.round(treePref.value)))
}

function startDrag(event: PointerEvent) {
  const start = treeWidth.value
  dragging.value = dragResize(event, {
    move: (delta) => setTree(start + delta),
    end: (delta) => {
      setTree(start + delta, true)
      dragging.value = false
    },
  })
}

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
  flex: none;
  flex-direction: column;
  min-inline-size: 0;
}

.file-panel-viewer {
  flex: 1;
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
