<template>
  <div
    class="command-menu surface-float"
    :id="menuId"
    role="listbox"
    :aria-label="ariaLabel"
    @mousedown.prevent
  >
    <template v-if="groups.length">
      <div v-for="group in groups" :key="group.id" class="command-group">
        <p v-if="group.label" class="command-label">{{ group.label }}</p>

        <div
          v-for="row in group.rows"
          :key="row.id"
          :id="`${menuId}-row-${encodeRowId(row.id)}`"
          :ref="(el) => setRowRef(row.id, el)"
          role="option"
          class="command-row"
          :aria-selected="row.id === activeId"
          :data-active="row.id === activeId ? '' : undefined"
          @mousemove="emit('highlight', row.id)"
          @mousedown.prevent
          @click="emit('select', row.id)"
        >
          <span class="command-icon" aria-hidden="true">
            <component :is="row.icon" v-if="row.icon" />
            <FolderIcon v-else-if="row.directory" class="command-glyph" />
            <DocumentIcon v-else class="command-glyph" />
          </span>

          <span class="command-main">
            <span class="command-title">{{ row.title }}</span>
            <span v-if="row.secondary" class="command-secondary">{{ row.secondary }}</span>
          </span>

          <span v-if="row.trailing" class="command-trailing">{{ row.trailing }}</span>
        </div>
      </div>
    </template>

    <p v-else class="command-status" :data-loading="loading || undefined">{{ statusText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch, type Component } from "vue"
import { DocumentIcon, FolderIcon } from "@components/icons/index.js"

export interface CommandMenuRow {
  id: string
  title: string
  /** 标题右侧弱化说明（描述或参数提示）。 */
  secondary?: string | undefined
  /** 行尾元信息（路径、来源）。 */
  trailing?: string | undefined
  icon?: Component
  /** 无图标时用目录占位符（文件行图标由父级决定）。 */
  directory?: boolean
}

export interface CommandMenuGroup {
  id: string
  label?: string
  rows: CommandMenuRow[]
}

const props = withDefaults(
  defineProps<{
    groups: CommandMenuGroup[]
    activeId: string | null
    /** listbox 的 id，textarea 用它挂 aria-controls / activedescendant。 */
    menuId?: string
    loading?: boolean
    emptyText?: string
    loadingText?: string
    ariaLabel?: string
  }>(),
  {
    menuId: "composer-command-menu",
    loading: false,
    emptyText: "没有匹配项",
    loadingText: "搜索中…",
    ariaLabel: "命令菜单",
  },
)
const emit = defineEmits<{
  select: [id: string]
  highlight: [id: string]
}>()
const statusText = computed(() => (props.loading ? props.loadingText : props.emptyText))
const rowRefs = new Map<string, HTMLElement>()

function setRowRef(id: string, el: Element | Component | null) {
  if (el instanceof HTMLElement) rowRefs.set(id, el)
  else rowRefs.delete(id)
}

/** id 里可能有空白/斜杠（文件路径），编码成合法 HTML id。 */
function encodeRowId(id: string): string {
  return encodeURIComponent(id)
}

watch(
  () => props.activeId,
  async (id) => {
    if (!id) return
    await nextTick()
    rowRefs.get(id)?.scrollIntoView({ block: "nearest" })
  },
)
</script>

<style scoped>
.command-menu {
  position: absolute;
  inset-inline: 0;
  bottom: calc(100% + var(--spacing-xs));
  z-index: var(--z-drawer);
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--spacing-xxs);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-xl);
  corner-shape: var(--corner-shape-composer);
  box-shadow: var(--shadow-float);
  scrollbar-width: none;
}

.command-menu::-webkit-scrollbar {
  display: none;
}

.command-label {
  margin: 0;
  padding: var(--spacing-xxs) var(--spacing-xs) var(--spacing-xxs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.command-group + .command-group {
  margin-top: var(--spacing-xxs);
  border-top: var(--border-width) solid var(--border-subtle);
  padding-top: var(--spacing-xxs);
}

.command-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border-radius: var(--radius-lg);
  corner-shape: var(--corner-shape-composer);
  color: var(--ink);
  font-size: var(--text-button);
  line-height: var(--text-button--line-height);
  cursor: pointer;
  user-select: none;
  transition: background var(--duration-fast) var(--ease-smooth);
}

.command-row:hover,
.command-row[data-active] {
  background: var(--hover-tint);
}

.command-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--ink-muted);
}

.command-glyph,
.command-icon svg {
  width: 14px;
  height: 14px;
}

.command-main {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
}

.command-title {
  flex: none;
  font-weight: var(--font-weight-medium);
}

.command-secondary {
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-trailing {
  flex: none;
  margin-inline-start: auto;
  padding-inline-start: var(--spacing-xs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
}

.command-status {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
}
</style>
