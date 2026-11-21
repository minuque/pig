<template>
  <TreeRoot
    ref="root"
    class="file-tree"
    :items="rootNodes"
    :get-key="(node: TreeNode) => node.path"
    :get-children="childrenOf"
    :expanded="pane.expanded.value"
    :aria-label="t('files.title')"
    @update:expanded="onExpanded"
  >
    <TreeVirtualizer
      v-slot="{ item }"
      :estimate-size="ROW_HEIGHT"
      :text-content="(node) => String(node.name).toLowerCase()"
    >
      <TreeItem
        v-slot="{ isExpanded }"
        :key="item._id"
        v-bind="item.bind"
        class="file-tree-row"
        :data-path="item.value.path"
        :data-active="item.value.path === active || undefined"
        :style="{ '--tree-level': item.level - 1 }"
        @select="(event: Event) => onSelect(event, item.value as TreeNode)"
        @dblclick="item.value.kind === 'file' && pane.openFile(item.value.path, { pin: true })"
      >
        <template v-if="item.value.kind === 'directory'">
          <ChevronRightIcon class="file-tree-caret" :data-open="isExpanded || undefined" />
          <FolderOpenIcon v-if="isExpanded" class="file-tree-icon" />
          <FolderIcon v-else class="file-tree-icon" />
        </template>

        <LanguageIcon
          v-else
          class="file-tree-icon is-file"
          :language="extension(item.value.name)"
        />

        <span class="file-tree-name">{{ item.value.name }}</span>
      </TreeItem>
    </TreeVirtualizer>
  </TreeRoot>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { TreeItem, TreeRoot, TreeVirtualizer } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { listWorkspaceDir } from "@client/platform.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from "@components/icons/index.js"
import { ancestors, rowIndex } from "@features/file-pane/lib/tree.js"
import { useFilePane } from "@features/file-pane/index.js"
import type { DirectoryEntry } from "@/types/common-type.js"

type TreeNode = DirectoryEntry & { path: string }

const { t } = useI18n()
const pane = useFilePane()
const ROW_HEIGHT = 28
const root = useTemplateRef<{ $el: HTMLElement }>("root")
const listed = shallowRef<Record<string, TreeNode[]>>({})
const active = computed(() => pane.tabs.value.active)
const rootNodes = computed(() => listed.value[""] ?? [])
const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "text"
const childrenOf = (node: TreeNode) =>
  node.kind === "directory" ? (listed.value[node.path] ?? []) : undefined

async function load(dir: string) {
  const cwd = pane.cwd.value

  if (!cwd) return

  const { entries } = await listWorkspaceDir(cwd, dir || ".").catch(() => ({ entries: [] }))
  const nodes = entries.map((entry) => ({
    ...entry,
    path: dir ? `${dir}/${entry.name}` : entry.name,
  }))

  if (cwd === pane.cwd.value) listed.value = { ...listed.value, [dir]: nodes }
}

async function refresh() {
  const cwd = pane.cwd.value

  if (!cwd) return

  await Promise.all(["", ...pane.expanded.value].map(load))
}

function onExpanded(next: string[]) {
  pane.setExpanded(next)
}

function onSelect(event: Event, node: TreeNode) {
  if (node.kind === "file") {
    event.preventDefault()
    pane.openFile(node.path)
  }
}

watch(
  () => pane.cwd.value,
  () => {
    listed.value = {}
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

    const el = root.value?.$el
    const index = rowIndex(rootNodes.value, childrenOf, pane.expanded.value, request.path)

    if (!el || index < 0) return

    const top = index * ROW_HEIGHT

    if (top < el.scrollTop || top + ROW_HEIGHT > el.scrollTop + el.clientHeight)
      el.scrollTop = top - (el.clientHeight - ROW_HEIGHT) / 2
  },
  { immediate: true },
)
</script>

<style scoped>
.file-tree {
  flex: 1;
  min-block-size: 0;
  padding: var(--space-2xs) var(--space-xs) var(--space-sm);
  overflow: auto;
}

/* 外部：虚拟列表把行绝对定位，只给了左边，右边要自己贴住才铺满 */
.file-tree-row {
  inset-inline-end: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  block-size: var(--control-sm);
  padding-inline: calc(var(--space-xs) + var(--tree-level) * var(--space-md)) var(--space-xs);
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

.file-tree-caret {
  flex: none;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--fg-secondary);
  transition: transform var(--duration-fast) var(--ease-out);
}

.file-tree-caret[data-open] {
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

.file-tree-name {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
