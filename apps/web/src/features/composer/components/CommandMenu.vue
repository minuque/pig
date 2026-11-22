<template>
  <Teleport to="body">
    <div
      :id="menuId"
      class="command-menu"
      role="listbox"
      :aria-label="t('composer.commandMenuLabel')"
      :style="boxStyle"
      @mousedown.prevent
    >
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
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type Component } from "vue"
import { useEventListener, useResizeObserver } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { SquareCodeIcon, FileTextIcon, FolderIcon, BlocksIcon } from "@components/icons/index.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import type { CommandMenuGroup, CommandMenuRow } from "@features/composer/type.js"

const MENU_MAX_HEIGHT = 280
const MENU_MIN_HEIGHT = 96
const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 8
const KIND_ICONS: Record<string, Component> = {
  skill: BlocksIcon,
  builtin: SquareCodeIcon,
  directory: FolderIcon,
}
const props = withDefaults(
  defineProps<{
    groups: CommandMenuGroup[]
    activeId: string | null
    anchorEl?: HTMLElement | null
    menuId?: string
    loading?: boolean
    emptyText?: string
  }>(),
  { anchorEl: null, menuId: "composer-command-menu", loading: false },
)
const emit = defineEmits<{
  select: [id: string]
  highlight: [id: string]
}>()
const { t } = useI18n()
const anchor = computed(() => props.anchorEl)
const box = ref({ left: 0, width: 0, bottom: 0, maxHeight: MENU_MAX_HEIGHT })
const statusText = computed(() =>
  props.loading ? t("composer.commandLoading") : (props.emptyText ?? t("composer.commandEmpty")),
)
const boxStyle = computed(() => ({
  left: `${box.value.left}px`,
  width: `${box.value.width}px`,
  bottom: `${box.value.bottom}px`,
  maxHeight: `${box.value.maxHeight}px`,
}))

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

function measure() {
  const element = props.anchorEl

  if (!element) return
  const rect = element.getBoundingClientRect()
  const space = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN

  box.value = {
    left: rect.left,
    width: rect.width,
    bottom: window.innerHeight - rect.top + ANCHOR_GAP,
    maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(MENU_MIN_HEIGHT, space)),
  }
}

useEventListener(window, "resize", measure)

useEventListener(window, "scroll", measure, { capture: true })

useResizeObserver(anchor, measure)

onMounted(measure)

watch(
  () => [props.anchorEl, props.groups],
  () => void nextTick(measure),
)

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
  position: fixed;
  z-index: var(--z-popover);
  overflow: hidden auto;
  border-radius: var(--radius-card);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  color: var(--fg);
  font-size: var(--text-body);
  corner-shape: var(--composer-corner-shape);
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
  cursor: pointer;
  user-select: none;
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
</style>
