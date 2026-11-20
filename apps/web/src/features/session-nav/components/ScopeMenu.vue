<template>
  <DropdownMenuContent
    side="bottom"
    align="start"
    :side-offset="4"
    class="scope-menu"
    @open-auto-focus.prevent="openSearch"
  >
    <div class="scope-search">
      <SearchIcon class="search-icon" />

      <input
        ref="searchRef"
        v-model="query"
        type="text"
        :placeholder="t('session.searchProjects')"
        :aria-label="t('session.searchProjects')"
      />
    </div>

    <div class="scope-projects">
      <DropdownMenuCheckboxItem
        v-if="!needle"
        class="scope-item"
        :model-value="scopeFilter.size === 0"
        @select.prevent="emit('update:scopeFilter', new Set())"
      >
        <span class="scope-icon">
          <FolderIcon class="size-icon-lg" />
          <span v-if="scopeFilter.size === 0" class="check-badge"><CheckIcon /></span>
        </span>

        <span class="scope-name">{{ t("session.allProjects") }}</span>
      </DropdownMenuCheckboxItem>

      <DropdownMenuCheckboxItem
        v-for="group in matched"
        :key="group.canonicalPath"
        class="scope-item scope-row"
        :model-value="scopeFilter.has(group.canonicalPath)"
        @select.prevent="toggleProject(group.canonicalPath)"
      >
        <span class="scope-icon">
          <ProjectIcon :path="group.canonicalPath" class="size-icon-lg" />
          <span v-if="scopeFilter.has(group.canonicalPath)" class="check-badge"><CheckIcon /></span>
        </span>

        <span class="scope-name">{{ workspaceName(group.canonicalPath) }}</span>

        <span class="scope-actions" @pointerdown.stop @pointerup.stop>
          <IconButton
            class="row-action"
            type="button"
            size="m"
            variant="ghost"
            color="gray"
            tabindex="-1"
            :title="t('session.projectIcon')"
            :aria-label="t('session.projectIcon')"
            @click.stop.prevent="emit('settings', group.canonicalPath)"
          >
            <SettingsIcon />
          </IconButton>

          <IconButton
            class="row-action"
            :data-pinned="isPinned(group.canonicalPath) || undefined"
            type="button"
            size="m"
            variant="ghost"
            color="gray"
            tabindex="-1"
            :title="pinLabel(group.canonicalPath)"
            :aria-label="pinLabel(group.canonicalPath)"
            @click.stop.prevent="togglePinned(group.canonicalPath)"
          >
            <PinIcon />
          </IconButton>
        </span>
      </DropdownMenuCheckboxItem>

      <p v-if="!matched.length" class="scope-empty">{{ t("session.noMatchingProjects") }}</p>
    </div>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
} from "@components/ui/dropdown-menu/index.js"
import { IconButton } from "@components/ui/button/index.js"
import {
  CheckIcon,
  FolderIcon,
  PinIcon,
  SearchIcon,
  SettingsIcon,
} from "@components/icons/index.js"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import { useProjectPrefs } from "@features/session-nav/hooks/use-project-prefs.js"
import { orderPinnedFirst } from "@features/session-nav/lib/project-prefs.js"
import type { SessionGroup } from "@features/session-nav/type.js"

const props = defineProps<{
  groups: readonly SessionGroup[]
  scopeFilter: ReadonlySet<string>
}>()
const emit = defineEmits<{
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  settings: [canonicalPath: string]
}>()
const { t } = useI18n()
const query = shallowRef("")
const searchRef = useTemplateRef<HTMLInputElement>("searchRef")
const { prefs, isPinned, togglePinned } = useProjectPrefs()
const needle = computed(() => query.value.trim().toLowerCase())
const matched = computed(() =>
  orderPinnedFirst(props.groups, prefs.value.pinned).filter((group) =>
    workspaceName(group.canonicalPath).toLowerCase().includes(needle.value),
  ),
)

function pinLabel(canonicalPath: string): string {
  const name = workspaceName(canonicalPath)
  return isPinned(canonicalPath)
    ? t("session.unpinProject", { name })
    : t("session.pinProject", { name })
}

function openSearch(): void {
  query.value = ""
  searchRef.value?.focus()
}

function toggleProject(canonicalPath: string): void {
  const next = new Set(props.scopeFilter)

  if (next.has(canonicalPath)) next.delete(canonicalPath)
  else next.add(canonicalPath)
  emit("update:scopeFilter", next)
}
</script>

<style scoped>
.scope-search {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-block-size: var(--control-md);
  margin-block-end: var(--space-2xs);
  padding-inline: var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.search-icon {
  color: var(--fg-secondary);
}

.scope-search input {
  flex: 1;
  min-inline-size: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font: inherit;
}

.scope-search input::placeholder {
  color: var(--fg-secondary);
}

.scope-empty {
  padding: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

/* 项目多时只露固定行数，其余在菜单内滚动，菜单不会被撑到视口外 */
.scope-projects {
  display: flex;
  flex-direction: column;
  max-block-size: calc((var(--control-md) + var(--menu-item-gap)) * 9);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.scope-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 选中态：图标右下角打勾，行本身不铺选中底 */
.scope-item[data-state="checked"]:not([data-highlighted]) {
  background-color: transparent;
}

/* 滚动列是纵向 flex：行不许被压缩，否则没有按钮撑着的「全部项目」会变矮 */
.scope-item {
  flex: none;
}

.scope-icon {
  position: relative;
  display: flex;
  flex: none;
}

.check-badge {
  position: absolute;
  inset-block-end: calc(var(--space-2xs) * -1);
  inset-inline-end: calc(var(--space-2xs) * -1);
  display: grid;
  place-items: center;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  border-radius: var(--radius-pill);
  background-color: var(--accent-solid);
  box-shadow: 0 0 0 calc(var(--border-width) * 2) var(--bg-raised);
  color: var(--fg-on-accent);
}

.check-badge .lucide {
  inline-size: calc(var(--icon-sm) - var(--space-2xs));
  block-size: calc(var(--icon-sm) - var(--space-2xs));
  stroke-width: calc(var(--icon-stroke) * 2);
}

.scope-actions {
  display: flex;
  margin-inline-start: auto;
  padding-inline-start: var(--space-xs);
}

/* 行尾操作：悬停或键盘高亮时出现；已置顶的图钉常显 */
.row-action:not([data-pinned]) {
  visibility: hidden;
}

.scope-row[data-highlighted] .row-action {
  visibility: visible;
}
</style>
