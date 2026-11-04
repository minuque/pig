<template>
  <div class="scope-menu surface-float" :class="{ 'is-above': placement === 'above' }" @click.stop>
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
      :class="{ on: scopeFilter.size === 0 }"
      type="button"
      @click="emit('update:scopeFilter', new Set())"
    >
      <span class="scope-fav"><FolderIcon :size="12" /></span>
      <span class="scope-name">{{ t("session.allProjects") }}</span>
      <span class="scope-cnt">{{ allSessionsCount }}</span>

      <span class="scope-ck">
        <CheckIcon v-if="scopeFilter.size === 0" :size="12" />

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

    <button
      v-for="g in groups"
      :key="g.canonicalPath"
      class="scope-item"
      :class="{ on: scopeFilter.has(g.canonicalPath) }"
      type="button"
      @click="toggleProject(g.canonicalPath)"
    >
      <span class="scope-fav"><FolderIcon :size="12" /></span>
      <span class="scope-name">{{ workspaceName(g.canonicalPath) }}</span>
      <span class="scope-cnt">{{ g.sessions.length }}</span>

      <span class="scope-ck">
        <CheckIcon v-if="scopeFilter.has(g.canonicalPath)" :size="12" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  CheckIcon,
  DocumentAddIcon,
  FolderIcon,
  HistoryIcon,
  SettingsIcon,
} from "@components/icons/index.js"
import type { SessionGroup, SidebarSort } from "@features/session-nav/type.js"

const props = withDefaults(
  defineProps<{
    groups: readonly SessionGroup[]
    sort: SidebarSort
    scopeFilter: ReadonlySet<string>
    placement?: "below" | "above"
  }>(),
  { placement: "below" },
)
const emit = defineEmits<{
  "update:sort": [sort: SidebarSort]
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
  settings: []
}>()
const { t } = useI18n()
const sortOptions = computed(() => [
  { value: "updated" as const, label: t("session.sortUpdated"), icon: HistoryIcon },
  { value: "created" as const, label: t("session.sortCreated"), icon: DocumentAddIcon },
])
const allSessionsCount = computed(() =>
  props.groups.reduce((sum, group) => sum + group.sessions.length, 0),
)

function toggleProject(canonicalPath: string): void {
  const next = new Set(props.scopeFilter)

  if (next.has(canonicalPath)) next.delete(canonicalPath)
  else next.add(canonicalPath)
  emit("update:scopeFilter", next)
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

/* 挂在页脚按钮上：菜单朝上展开，宽度对齐列表。 */
.scope-menu.is-above {
  inset-inline: var(--nav-inline) 10px;
  top: auto;
  bottom: calc(100% + 4px);
  max-width: none;
  margin-block: 0;
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
