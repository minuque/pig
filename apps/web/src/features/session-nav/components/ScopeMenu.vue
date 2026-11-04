<template>
  <DropdownMenuContent side="top" align="end" :side-offset="4" class="scope-menu">
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

    <DropdownMenuSeparator />

    <DropdownMenuItem @select="emit('settings')">
      <SettingsIcon :size="12" />
      {{ t("nav.settings") }}
    </DropdownMenuItem>
  </DropdownMenuContent>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { workspaceName } from "@features/session-nav/index.js"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@components/ui/dropdown-menu/index.js"
import { DocumentAddIcon, FolderIcon, HistoryIcon, SettingsIcon } from "@components/icons/index.js"
import type { SessionGroup, SidebarSort } from "@features/session-nav/type.js"

const props = defineProps<{
  groups: readonly SessionGroup[]
  sort: SidebarSort
  scopeFilter: ReadonlySet<string>
}>()
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
