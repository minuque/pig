<template>
  <div
    :id="menuId"
    class="command-menu"
    role="listbox"
    :aria-label="t('composer.commandMenuLabel')"
    @mousedown.prevent
  >
    <div class="command-scroll">
      <div class="command-body">
        <template v-if="groups.length">
          <div v-for="group in groups" :key="group.id" class="command-group">
            <p v-if="group.label" class="command-label">{{ group.label }}</p>

            <div
              v-for="row in group.rows"
              :id="rowElementId(row.id)"
              :key="row.id"
              role="option"
              class="command-row"
              :aria-selected="row.id === activeId"
              @mousemove="emit('highlight', row.id)"
              @click="emit('select', row.id)"
            >
              <component
                :is="rowIcon(row)"
                v-bind="rowIconProps(row)"
                class="command-icon"
                aria-hidden="true"
              />

              <span class="command-main">
                <span class="command-title">{{ row.title }}</span>

                <span v-if="row.secondary" class="command-secondary" :title="row.secondary">
                  {{ row.secondary }}
                </span>
              </span>
            </div>
          </div>
        </template>

        <p v-else class="command-status" role="status">{{ statusText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch, type Component } from "vue"
import { useI18n } from "@i18n/index.js"
import { SquareCodeIcon, FileTextIcon, FolderIcon, BlocksIcon } from "@components/icons/index.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import type { CommandMenuGroup, CommandMenuRow } from "@features/composer/type.js"

const KIND_ICONS: Record<string, Component> = {
  skill: BlocksIcon,
  builtin: SquareCodeIcon,
  directory: FolderIcon,
}
const props = withDefaults(
  defineProps<{
    groups: CommandMenuGroup[]
    activeId: string | null
    menuId?: string
    loading?: boolean
    emptyText?: string
  }>(),
  { menuId: "composer-command-menu", loading: false },
)
const emit = defineEmits<{
  select: [id: string]
  highlight: [id: string]
}>()
const { t } = useI18n()
const statusText = computed(() =>
  props.loading ? t("composer.commandLoading") : (props.emptyText ?? t("composer.commandEmpty")),
)

function rowIcon(row: CommandMenuRow) {
  if (row.kind === "file") return LanguageIcon
  return row.icon ?? KIND_ICONS[row.kind ?? ""] ?? FileTextIcon
}

function rowIconProps(row: CommandMenuRow) {
  return row.kind === "file" ? { language: rowLanguage(row.title) } : {}
}

function rowLanguage(name: string): string {
  const dot = name.lastIndexOf(".")
  return (dot > 0 ? name.slice(dot + 1) : name).toLowerCase()
}

function rowElementId(id: string): string {
  return `${props.menuId}-row-${encodeURIComponent(id)}`
}

watch(
  () => props.activeId,
  async (id) => {
    if (!id) return
    await nextTick()
    document.getElementById(rowElementId(id))?.scrollIntoView({ block: "nearest" })
  },
)
</script>

<style scoped>
.command-menu {
  position: absolute;
  inset-inline: 0;
  bottom: calc(100% - var(--composer-radius));
  display: flex;
  flex-direction: column;
  max-height: calc(280px + var(--composer-radius));
  overflow: hidden;
  padding-bottom: var(--composer-radius);
  border-radius: var(--radius-dialog) var(--radius-dialog) 0 0;
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
  color: var(--fg);
  font-size: var(--text-body);
}

.command-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.command-body {
  padding: var(--space-2xs);
}

.command-label {
  margin: 0;
  padding: var(--space-2xs) var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-semibold);
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
  min-width: 0;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: calc(var(--radius-card) - var(--space-2xs));
  corner-shape: var(--composer-corner-shape);
  cursor: pointer;
  user-select: none;
  transition: background var(--duration-fast) var(--ease-out);
}

.command-row:hover,
.command-row[aria-selected="true"] {
  background: var(--bg-hover);
}

.command-icon {
  flex: none;
  width: var(--icon-md);
  height: var(--icon-md);
  color: var(--fg-muted);
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

.command-status {
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

@media (prefers-reduced-motion: reduce) {
  .command-row {
    transition: none;
  }
}
</style>
