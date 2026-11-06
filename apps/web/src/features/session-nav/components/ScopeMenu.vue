<template>
  <DropdownMenuContent
    side="bottom"
    align="start"
    :side-offset="4"
    variant="soft"
    class="scope-menu"
  >
    <DropdownMenuLabel>{{ t("session.sorting") }}</DropdownMenuLabel>

    <DropdownMenuRadioGroup :model-value="sort">
      <DropdownMenuRadioItem
        v-for="option in sortOptions"
        :key="option.value"
        :value="option.value"
        @select.prevent="emit('update:sort', option.value)"
      >
        <component :is="option.icon" :size="12" />
        {{ option.label }}
      </DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>

    <DropdownMenuSeparator />

    <DropdownMenuCheckboxItem
      :model-value="scopeFilter.size === 0"
      @select.prevent="emit('update:scopeFilter', new Set())"
    >
      <FolderIcon :size="12" />
      <span class="scope-name">{{ t("session.allProjects") }}</span>
      <span class="scope-cnt">{{ allSessionsCount }}</span>
    </DropdownMenuCheckboxItem>

    <div class="scope-projects">
      <DropdownMenuCheckboxItem
        v-for="group in groups"
        :key="group.canonicalPath"
        :model-value="scopeFilter.has(group.canonicalPath)"
        @select.prevent="toggleProject(group.canonicalPath)"
      >
        <FolderIcon :size="12" />
        <span class="scope-name">{{ workspaceName(group.canonicalPath) }}</span>
        <span class="scope-cnt">{{ group.sessions.length }}</span>
      </DropdownMenuCheckboxItem>
    </div>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@components/ui/dropdown-menu/index.js"
import { DocumentAddIcon, FolderIcon, HistoryIcon } from "@components/icons/index.js"
import type { SessionGroup, SidebarSort } from "@features/session-nav/type.js"

const props = defineProps<{
  groups: readonly SessionGroup[]
  sort: SidebarSort
  scopeFilter: ReadonlySet<string>
}>()
const emit = defineEmits<{
  "update:sort": [sort: SidebarSort]
  "update:scopeFilter": [scopeFilter: ReadonlySet<string>]
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
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
}
</style>
