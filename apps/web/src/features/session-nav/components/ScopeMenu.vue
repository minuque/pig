<template>
  <div class="scope-menu surface-float" @click.stop>
    <p class="scope-label">{{ t("session.grouping") }}</p>

    <button
      v-for="option in groupingOptions"
      :key="option.value"
      class="scope-item"
      :class="{ on: grouping === option.value }"
      type="button"
      @click="emit('update:grouping', option.value)"
    >
      <span class="scope-fav"><component :is="option.icon" :size="12" /></span>
      <span class="scope-name">{{ option.label }}</span>

      <span class="scope-ck">
        <CheckIcon v-if="grouping === option.value" :size="10" />
      </span>
    </button>

    <p class="scope-label">{{ t("session.sorting") }}</p>

    <button
      v-for="option in sortOptions"
      :key="option.value"
      class="scope-item"
      :class="{ on: sort === option.value }"
      type="button"
      @click="emit('update:sort', option.value)"
    >
      <span class="scope-fav"><component :is="option.icon" :size="12" /></span>
      <span class="scope-name">{{ option.label }}</span>

      <span class="scope-ck">
        <CheckIcon v-if="sort === option.value" :size="10" />
      </span>
    </button>

    <div class="scope-sep" role="separator"></div>

    <button
      class="scope-item"
      :class="{ on: !scopeFilter }"
      type="button"
      @click="pickScope(undefined)"
    >
      <span class="scope-fav"><FolderIcon :size="12" /></span>
      <span class="scope-name">{{ t("session.allProjects") }}</span>
      <span class="scope-cnt">{{ allSessionsCount }}</span>

      <span class="scope-ck">
        <CheckIcon v-if="!scopeFilter" :size="12" />

        <span
          class="scope-edit"
          role="button"
          tabindex="-1"
          :title="t('nav.settings')"
          @click.stop="emit('settings')"
        >
          <SettingsIcon :size="12" />
        </span>
      </span>
    </button>

    <span
      v-for="g in groups"
      :key="g.canonicalPath"
      class="scope-item"
      :class="{ on: scopeFilter === workspaceName(g.canonicalPath) }"
      role="menuitem"
      tabindex="0"
      @click="pickScope(workspaceName(g.canonicalPath))"
      @keydown.enter.prevent="pickScope(workspaceName(g.canonicalPath))"
    >
      <span class="scope-fav">
        <component :is="scopeIcon(workspaceName(g.canonicalPath))" :size="12" />
      </span>

      <span class="scope-name">{{ workspaceName(g.canonicalPath) }}</span>
      <span class="scope-cnt">{{ g.sessions.length }}</span>

      <span class="scope-ck">
        <CheckIcon v-if="scopeFilter === workspaceName(g.canonicalPath)" :size="12" />

        <span
          class="scope-edit"
          role="button"
          tabindex="-1"
          :title="t('session.projectSettings')"
          @click.stop="emit('editProject', workspaceName(g.canonicalPath))"
        >
          <SettingsIcon :size="12" />
        </span>
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  loadProjIcons,
  projectIconComponent,
  type ProjIcon,
} from "@features/session-nav/lib/project-icon.js"
import {
  CheckIcon,
  ClockCircleIcon,
  DocumentAddIcon,
  FolderIcon,
  HistoryIcon,
  SettingsIcon,
} from "@components/icons/index.js"
import type { SessionGroup, SidebarGrouping, SidebarSort } from "@features/session-nav/type.js"

const props = defineProps<{
  groups: readonly SessionGroup[]
  grouping: SidebarGrouping
  sort: SidebarSort
  scopeFilter: string | undefined
}>()
const emit = defineEmits<{
  "update:grouping": [grouping: SidebarGrouping]
  "update:sort": [sort: SidebarSort]
  "update:scopeFilter": [name: string | undefined]
  settings: []
  editProject: [project: string]
}>()
const { t } = useI18n()
const projIcons = shallowRef<Record<string, ProjIcon>>(loadProjIcons())
const groupingOptions = computed(() => [
  { value: "date" as const, label: t("session.groupDate"), icon: ClockCircleIcon },
  { value: "cwd" as const, label: t("session.groupCwd"), icon: FolderIcon },
])
const sortOptions = computed(() => [
  { value: "updated" as const, label: t("session.sortUpdated"), icon: HistoryIcon },
  { value: "created" as const, label: t("session.sortCreated"), icon: DocumentAddIcon },
])
const allSessionsCount = computed(() =>
  props.groups.reduce((sum, group) => sum + group.sessions.length, 0),
)

function scopeIcon(project: string | undefined) {
  return projectIconComponent(project ? projIcons.value[project] : undefined)
}

function pickScope(name: string | undefined): void {
  emit("update:scopeFilter", name)
}
</script>

<style scoped>
.scope-label {
  margin: 0;
  padding: var(--space-xxs) var(--space-xs) 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.scope-sep {
  height: 1px;
  margin-block: var(--space-xxs);
  background: var(--border);
}

.scope-fav {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.scope-menu {
  position: absolute;
  z-index: var(--z-menu);
  /* 搜索行的横向内边距在 .search-head 上，定位基准跟着挪一档，保持左缘对齐。 */
  inset-inline-start: var(--nav-inline);
  inset-inline-end: 10px;
  top: 100%;
  max-height: min(60vh, 480px);
  overflow-y: auto;
  margin-block-start: 4px;
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--card);
  box-shadow: var(--shadow-float);
  font-size: var(--text-caption);
}

.scope-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  padding: var(--space-xxs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
  line-height: var(--text-caption--line-height);
  text-align: start;
  cursor: default;
  user-select: none;
}

.scope-item:hover {
  background: var(--sidebar-hover);
}

.scope-item.on {
  color: var(--primary);
}

.scope-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-cnt {
  flex: none;
  min-width: 3ch;
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
  color: var(--contrast-foreground-muted);
  text-align: end;
}

.scope-ck {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--primary);
}

.scope-ck > .solar,
.scope-ck > .scope-edit {
  grid-area: 1 / 1;
  transition: opacity 0.15s;
}

.scope-ck > .solar {
  opacity: 1;
}

.scope-ck > .scope-edit {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
  opacity: 0;
  cursor: pointer;
}

.scope-item:hover .scope-ck > .solar {
  opacity: 0;
}

.scope-item:hover .scope-edit {
  opacity: 1;
}

.scope-edit:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}
</style>
