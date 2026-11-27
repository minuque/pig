<template>
  <ContextMenu>
    <ContextMenuTrigger>
      <template #render="{ props: part }">
        <div
          v-bind="part"
          ref="scroller"
          class="file-tree"
          @scroll="onScroll"
          @contextmenu.capture="onContextMenu"
        >
          <Tree
            ref="tree"
            class="file-tree-list"
            mode="none"
            :items="items"
            :expanded="pane.expanded.value"
            :aria-label="t('files.title')"
            :style="{ blockSize: `${rows.length * ROW_HEIGHT}px` }"
            @update:expanded="pane.setExpanded"
            @highlight="(_value: string, details: ListHighlightDetails) => reveal(details.index)"
            @action="onAction"
          >
            <TreeItem
              v-for="{ item, index } in visible"
              :key="item.value"
              :value="item.value"
              class="file-tree-row"
              :data-path="item.value"
              :data-active="item.value === active || undefined"
              :style="{ insetBlockStart: `${index * ROW_HEIGHT}px` }"
              draggable="true"
              @dragstart="onDragStart($event, item.value)"
              @dblclick="!item.children && pane.openFile(item.value, { pin: true })"
            >
              <TreeItemLabel v-slot="{ state }" class="file-tree-label">
                <template v-if="item.children">
                  <TreeItemIndicator class="file-tree-caret">
                    <ChevronRightIcon class="file-tree-caret-icon" />
                  </TreeItemIndicator>

                  <FolderOpenIcon v-if="state.expanded" class="file-tree-icon" />
                  <FolderIcon v-else class="file-tree-icon" />
                </template>

                <LanguageIcon
                  v-else
                  class="file-tree-icon is-file"
                  :language="extension(item.label)"
                />

                <span class="file-tree-name">{{ item.label }}</span>
              </TreeItemLabel>
            </TreeItem>
          </Tree>

          <EmptyState
            v-if="rootFailed"
            size="row"
            class="file-tree-empty"
            :title="t('files.dirFailed')"
          >
            <template #actions>
              <RetryButton size="s" variant="ghost" :action="() => load('')" />
            </template>
          </EmptyState>

          <EmptyState
            v-else-if="listed[''] && !listed[''].length"
            size="row"
            class="file-tree-empty"
            :title="t('files.dirEmpty')"
          />
        </div>
      </template>
    </ContextMenuTrigger>

    <ContextMenuContent v-if="menuPath" size="s">
      <ContextMenuItem @select="pane.mentionInChat(menuPath)">
        <AtSignIcon />
        {{ t("files.mentionInChat") }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useResizeObserver } from "@vueuse/core"
import {
  Tree,
  TreeItem,
  TreeItemIndicator,
  TreeItemLabel,
  visibleTreeRows,
  type ListHighlightDetails,
  type TreeItemData,
} from "@ui-sdk/vue/tree"
import { useI18n } from "@i18n/index.js"
import { listWorkspaceDir } from "@client/platform.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import RetryButton from "@components/empty/RetryButton.vue"
import { EmptyState } from "@pig/ui/empty-state"
import {
  AtSignIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@components/icons/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@pig/ui/context-menu"
import { COMPOSER_MENTION_MIME, mentionMarkdown } from "@features/composer/lib/composer-trigger.js"
import { ancestors } from "@features/file-pane/lib/tree.js"
import { useFilePane } from "@features/file-pane/index.js"
import type { DirectoryEntry } from "@/types/common-type.js"

type TreeNode = DirectoryEntry & { path: string }

const { t } = useI18n()
const pane = useFilePane()
const ROW_HEIGHT = 28
const OVERSCAN = 8
const scroller = useTemplateRef<HTMLElement>("scroller")
const tree = useTemplateRef<{ $el: HTMLElement }>("tree")
const listed = shallowRef<Record<string, TreeNode[]>>({})
const rootFailed = shallowRef(false)
const scrollTop = shallowRef(0)
const height = shallowRef(0)
const active = computed(() => pane.tabs.value.active)
const items = computed(() => toItems(listed.value[""] ?? []))
const rows = computed(() => visibleTreeRows(items.value, pane.expanded.value))
const visible = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - OVERSCAN)
  const end = Math.ceil((scrollTop.value + height.value) / ROW_HEIGHT) + OVERSCAN
  return rows.value.slice(start, end)
})
const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "text"

function toItems(nodes: TreeNode[]): TreeItemData[] {
  return nodes.map((node) =>
    node.kind === "directory"
      ? { value: node.path, label: node.name, children: toItems(listed.value[node.path] ?? []) }
      : { value: node.path, label: node.name },
  )
}

async function load(dir: string) {
  const cwd = pane.cwd.value

  if (!cwd) return

  try {
    const { entries } = await listWorkspaceDir(cwd, dir || ".")
    const nodes = entries.map((entry) => ({
      ...entry,
      path: dir ? `${dir}/${entry.name}` : entry.name,
    }))

    if (cwd !== pane.cwd.value) return
    listed.value = { ...listed.value, [dir]: nodes }

    if (!dir) rootFailed.value = false
  } catch {
    if (!dir && cwd === pane.cwd.value) rootFailed.value = true
  }
}

async function refresh() {
  const cwd = pane.cwd.value

  if (!cwd) return

  await Promise.all(["", ...pane.expanded.value].map(load))
}

function onScroll(event: Event) {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

function onDragStart(event: DragEvent, path: string) {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = "copy"
  event.dataTransfer.setData(COMPOSER_MENTION_MIME, mentionMarkdown(path))
}

const menuPath = shallowRef<string>()

function onContextMenu(event: MouseEvent) {
  const row = event.target instanceof Element ? event.target.closest("[data-path]") : null
  menuPath.value = row?.getAttribute("data-path") ?? undefined
}

function onAction(value: string) {
  const row = rows.value.find((entry) => entry.item.value === value)

  if (row && !row.item.children) pane.openFile(value)
}

function reveal(index: number, center = false) {
  const el = scroller.value

  if (!el || index < 0) return

  const top = (tree.value?.$el.offsetTop ?? 0) + index * ROW_HEIGHT

  if (center && (top < el.scrollTop || top + ROW_HEIGHT > el.scrollTop + el.clientHeight))
    el.scrollTop = top - (el.clientHeight - ROW_HEIGHT) / 2
  else if (top < el.scrollTop) el.scrollTop = top
  else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight)
    el.scrollTop = top + ROW_HEIGHT - el.clientHeight

  scrollTop.value = el.scrollTop
}

useResizeObserver(scroller, ([entry]) => {
  if (entry) height.value = entry.contentRect.height
})

watch(
  () => pane.cwd.value,
  () => {
    listed.value = {}
    rootFailed.value = false
    void refresh()
  },
  { immediate: true },
)

watch(() => pane.changes.value, refresh)

watch(
  () => pane.expanded.value,
  (dirs) => {
    for (const dir of dirs) if (!listed.value[dir]) void load(dir)
  },
)

watch(
  () => pane.request.value,
  async (request) => {
    if (!request) return

    const dirs = ancestors(request.path)
    await Promise.all(dirs.filter((dir) => !listed.value[dir]).map(load))
    pane.setExpanded([...new Set([...pane.expanded.value, ...dirs])])
    await nextTick()
    reveal(
      rows.value.findIndex((row) => row.item.value === request.path),
      true,
    )
  },
  { immediate: true },
)
</script>

<style scoped>
.file-tree {
  position: relative;
  flex: 1;
  min-block-size: 0;
  padding: var(--space-2xs) var(--space-xs) var(--space-sm);
  overflow: auto;
}

.file-tree-list {
  position: relative;
}

.file-tree-row {
  position: absolute;
  inset-inline: 0;
  block-size: var(--control-sm);
  padding-inline: calc(var(--space-xs) + (var(--tree-level) - 1) * var(--space-md)) var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  white-space: nowrap;
  cursor: default;
  outline: none;
  user-select: none;
}

.file-tree-row:hover {
  background: var(--bg-hover);
}

.file-tree-row[data-active] {
  background: var(--bg-selected);
  color: var(--fg);
}

.file-tree-row:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

.file-tree-label {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  block-size: 100%;
}

.file-tree-caret {
  display: inline-flex;
  flex: none;
  color: var(--fg-secondary);
  transition: transform var(--duration-fast) var(--ease-out);
}

.file-tree-caret-icon {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}

.file-tree-caret[data-expanded] {
  transform: rotate(90deg);
}

.file-tree-row .file-tree-icon {
  flex: none;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

.file-tree-row .file-tree-icon.is-file {
  margin-inline-start: calc(var(--icon-sm) + var(--space-2xs));
}

.file-tree-empty {
  padding-inline: var(--space-xs);
}

.file-tree-name {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
