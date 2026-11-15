<template>
  <DropdownMenuContent
    side="bottom"
    align="start"
    :side-offset="4"
    variant="soft"
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

    <DropdownMenuCheckboxItem
      v-if="!needle"
      :model-value="scopeFilter.size === 0"
      @select.prevent="emit('update:scopeFilter', new Set())"
    >
      <FolderIcon class="size-icon-xs" />
      <span class="scope-name">{{ t("session.allProjects") }}</span>
      <span class="scope-cnt">{{ allSessionsCount }}</span>
    </DropdownMenuCheckboxItem>

    <div class="scope-projects">
      <DropdownMenuCheckboxItem
        v-for="group in matched"
        :key="group.canonicalPath"
        :model-value="scopeFilter.has(group.canonicalPath)"
        @select.prevent="toggleProject(group.canonicalPath)"
      >
        <FolderIcon class="size-icon-xs" />
        <span class="scope-name">{{ workspaceName(group.canonicalPath) }}</span>
        <span class="scope-cnt">{{ group.sessions.length }}</span>
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
import { FolderIcon, SearchIcon } from "@components/icons/index.js"
import type { SessionGroup } from "@features/session-nav/type.js"

const props = defineProps<{
  groups: readonly SessionGroup[]
  scopeFilter: ReadonlySet<string>
}>()
const emit = defineEmits<{
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
}>()
const { t } = useI18n()
const query = shallowRef("")
const searchRef = useTemplateRef<HTMLInputElement>("searchRef")
const needle = computed(() => query.value.trim().toLowerCase())
const matched = computed(() =>
  needle.value
    ? props.groups.filter((group) =>
        workspaceName(group.canonicalPath).toLowerCase().includes(needle.value),
      )
    : props.groups,
)
const allSessionsCount = computed(() =>
  props.groups.reduce((sum, group) => sum + group.sessions.length, 0),
)

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
  min-block-size: var(--size-composer-control);
  margin-block-end: var(--space-xxs);
  padding-inline: var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-soft);
}

.search-icon {
  color: var(--contrast-foreground-faint);
}

.scope-search input {
  flex: 1;
  min-inline-size: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font: inherit;
}

.scope-search input::placeholder {
  color: var(--contrast-foreground-faint);
}

.scope-empty {
  padding: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}

/* 项目多时只露固定行数，其余在菜单内滚动，菜单不会被撑到视口外 */
.scope-projects {
  max-block-size: calc(var(--size-nav-rail) * 9);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.scope-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-cnt {
  margin-inline-start: auto;
  padding-inline-start: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}
</style>
