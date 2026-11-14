<template>
  <div ref="scroller" class="file-tree">
    <TreeRoot
      v-slot="{ flattenItems }"
      class="file-tree-root"
      :items="rootNodes"
      :get-key="(node: TreeNode) => node.path"
      :get-children="childrenOf"
      :expanded="pane.expanded.value"
      :aria-label="t('files.title')"
      @update:expanded="onExpanded"
    >
      <TreeItem
        v-for="item in flattenItems"
        v-slot="{ isExpanded }"
        :key="item._id"
        v-bind="item.bind"
        class="file-tree-row"
        :data-path="item.value.path"
        :data-active="item.value.path === active || undefined"
        :data-ignored="item.value.ignored || undefined"
        :data-git="marks.get(item.value.path)"
        :style="{ '--tree-level': item.level - 1 }"
        @select="(event: Event) => onSelect(event, item.value)"
        @dblclick="item.value.kind === 'file' && pane.openFile(item.value.path, { pin: true })"
      >
        <template v-if="item.value.kind === 'directory'">
          <AltArrowRightIcon class="file-tree-caret" :data-open="isExpanded || undefined" />
          <FolderOpenIcon v-if="isExpanded" class="file-tree-icon" />
          <FolderIcon v-else class="file-tree-icon" />
        </template>

        <LanguageIcon
          v-else
          class="file-tree-icon is-file"
          :language="extension(item.value.name)"
        />

        <span class="file-tree-name">{{ item.value.name }}</span>

        <span v-if="marks.has(item.value.path)" class="file-tree-mark">
          {{ marks.get(item.value.path) === "dir" ? "•" : marks.get(item.value.path) }}
        </span>
      </TreeItem>
    </TreeRoot>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { TreeItem, TreeRoot } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { listWorkspaceDir, workspaceGitStatus } from "@client/platform.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import { AltArrowRightIcon, FolderIcon, FolderOpenIcon } from "@components/icons/index.js"
import { ancestors, gitMarks } from "@features/file-pane/lib/tree.js"
import { useFilePane } from "@features/file-pane/index.js"
import type { DirectoryEntry, GitFileStatus } from "@/types/common-type.js"

type TreeNode = DirectoryEntry & { path: string }

const { t } = useI18n()
const pane = useFilePane()
const scroller = useTemplateRef("scroller")
/** 已读过的目录：键是工作区相对路径，根是 ""。 */
const listed = shallowRef<Record<string, TreeNode[]>>({})
const status = shallowRef<GitFileStatus[]>([])
const marks = computed(() => gitMarks(status.value))
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

/** 重读根、所有展开过的目录与改动状态。 */
async function refresh() {
  const cwd = pane.cwd.value

  if (!cwd) return

  await Promise.all(["", ...pane.expanded.value].map(load))
  status.value = (await workspaceGitStatus(cwd).catch(() => ({ files: [] }))).files
}

function onExpanded(next: string[]) {
  for (const dir of next) if (!listed.value[dir]) void load(dir)
  pane.setExpanded(next)
}

function onSelect(event: Event, node: TreeNode) {
  // 目录交给 Reka 自己展开收起；文件开临时标签
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

// 从对话里打开文件时，展开它上面的目录并滚到它
watch(
  () => pane.request.value,
  async (request) => {
    if (!request) return

    const dirs = ancestors(request.path)
    await Promise.all(dirs.filter((dir) => !listed.value[dir]).map(load))
    pane.setExpanded([...new Set([...pane.expanded.value, ...dirs])])
    await nextTick()
    scroller.value
      ?.querySelector(`[data-path="${CSS.escape(request.path)}"]`)
      ?.scrollIntoView({ block: "nearest" })
  },
  { immediate: true },
)
</script>

<style scoped>
.file-tree {
  flex: 1;
  min-block-size: 0;
  padding: var(--space-xxs) var(--space-xs) var(--space-sm);
  overflow: auto;
}

.file-tree-row {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  block-size: var(--size-rail-row);
  padding-inline: calc(var(--space-xs) + var(--tree-level) * var(--space-md)) var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-body);
  white-space: nowrap;
  cursor: default;
  outline: none;
  user-select: none;
}

.file-tree-row:hover {
  background: var(--btn-hover);
}

.file-tree-row[data-active] {
  background: var(--btn-selected);
  color: var(--contrast-foreground);
}

.file-tree-row:focus-visible {
  outline: var(--focus-ring);
  outline-offset: -2px;
}

.file-tree-row[data-ignored] {
  color: var(--contrast-foreground-faint);
}

.file-tree-row[data-git="M"],
.file-tree-row[data-git="R"] {
  color: var(--warning);
}

.file-tree-row[data-git="A"],
.file-tree-row[data-git="U"] {
  color: var(--success);
}

.file-tree-row[data-git="D"] {
  color: var(--danger);
}

.file-tree-caret {
  flex: none;
  inline-size: var(--size-icon-xs);
  block-size: var(--size-icon-xs);
  color: var(--contrast-foreground-faint);
  transition: transform var(--duration-fast) var(--ease-out);
}

.file-tree-caret[data-open] {
  transform: rotate(90deg);
}

.file-tree-row .file-tree-icon {
  flex: none;
  inline-size: var(--size-icon);
  block-size: var(--size-icon);
}

/* 文件没有展开箭头：让出箭头的宽，与同级目录的图标对齐 */
.file-tree-row .file-tree-icon.is-file {
  margin-inline-start: calc(var(--size-icon-xs) + var(--space-xxs));
}

.file-tree-name {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-tree-mark {
  flex: none;
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}
</style>
