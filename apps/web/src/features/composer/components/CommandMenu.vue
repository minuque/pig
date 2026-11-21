<template>
  <div class="command-menu" :id="menuId" role="listbox" :aria-label="ariaLabel" @mousedown.prevent>
    <ScrollArea scrollbars="vertical" class="command-scroll">
      <div class="command-body">
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
                <BlocksIcon v-else-if="row.kind === 'skill'" class="command-glyph" />
                <FileTextIcon v-else-if="row.kind === 'template'" class="command-glyph" />
                <SquareCodeIcon v-else-if="row.kind === 'builtin'" class="command-glyph" />
                <FolderIcon v-else-if="row.directory" class="command-glyph" />
                <FileTextIcon v-else class="command-glyph" />
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
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch, type Component } from "vue"
import { SquareCodeIcon, FileTextIcon, FolderIcon, BlocksIcon } from "@components/icons/index.js"
import { ScrollArea } from "@components/ui/scroll-area/index.js"

export type CommandMenuRowKind = "skill" | "template" | "builtin" | "file" | "directory"

export interface CommandMenuRow {
  id: string
  title: string
  secondary?: string | undefined
  trailing?: string | undefined
  icon?: Component
  kind?: CommandMenuRowKind
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
  bottom: calc(100% + var(--space-xs));
  z-index: var(--z-drawer);
  display: flex;
  flex-direction: column;
  max-height: 280px;
  overflow: hidden;
  border: var(--border-width) solid var(--float-border);
  border-radius: var(--radius-card);
  corner-shape: var(--composer-corner-shape);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
}

.command-scroll {
  height: auto;
  min-height: 0;
  max-height: inherit;
}

.command-body {
  padding: var(--space-2xs);
}

.command-label {
  margin: 0;
  padding: var(--space-2xs) var(--space-xs) var(--space-2xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-meta--line-height);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.command-group + .command-group {
  margin-top: var(--space-2xs);
  border-top: var(--border-width) solid var(--border-subtle);
  padding-top: var(--space-2xs);
}

.command-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  min-width: 0;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: calc(var(--radius-card) - var(--space-2xs));
  corner-shape: var(--composer-corner-shape);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  cursor: pointer;
  user-select: none;
  transition: background var(--duration-fast) var(--ease-out);
}

.command-row:hover,
.command-row[data-active] {
  background: var(--bg-hover);
}

.command-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--fg-muted);
}

.command-glyph,
.command-icon svg {
  width: 14px;
  height: 14px;
}

.command-main {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  flex: 1;
  min-width: 0;
}

.command-title {
  flex: none;
  font-weight: var(--font-weight-medium);
}

.command-secondary {
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-trailing {
  flex: none;
  margin-inline-start: auto;
  padding-inline-start: var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.command-status {
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}
</style>
