<template>
  <CommandPalette :open="open" :title="t('nav.search')" @update:open="emit('update:open', $event)">
    <CommandPaletteInput v-model="query" :placeholder="t('nav.searchPlaceholder')" />

    <CommandPaletteList>
      <CommandPaletteEmpty v-if="!rows.length">{{ t("nav.searchEmpty") }}</CommandPaletteEmpty>

      <CommandPaletteItem
        v-for="row in rows"
        :key="row.id"
        :value="row.id"
        @select="activate(row.id)"
      >
        <template #icon><SquareCodeIcon class="size-icon" /></template>
        {{ row.title }}
        <template v-if="row.project" #description>{{ row.project }}</template>

        <template #trailing>
          <span class="row-time">{{ row.time }}</span>
        </template>
      </CommandPaletteItem>
    </CommandPaletteList>
  </CommandPalette>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"
import { useI18n } from "@i18n/index.js"
import {
  filterSessionsForSearch,
  sortSessionsForSidebar,
} from "@features/session-nav/lib/session-list.js"
import { formatRelativeTime, workspaceName } from "@features/session-nav/lib/format.js"
import {
  CommandPalette,
  CommandPaletteEmpty,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
} from "@components/ui/command-palette/index.js"
import { SquareCodeIcon } from "@components/icons/index.js"

const props = defineProps<{
  open: boolean
  sessions: readonly SessionMetadata[]
}>()
const emit = defineEmits<{
  "update:open": [open: boolean]
  open: [id: string]
}>()
const { t } = useI18n()
const query = shallowRef("")
const rows = computed(() => {
  const filtered = filterSessionsForSearch(props.sessions, query.value)
  return sortSessionsForSidebar(filtered)
    .slice(0, 50)
    .map((session) => ({
      id: session.id,
      title: session.sessionName?.trim() || t("session.untitled"),
      project: session.cwd ? workspaceName(session.cwd) : undefined,
      time: formatRelativeTime(session.updatedAt ?? session.createdAt),
    }))
})

watch(
  () => props.open,
  (open) => {
    if (!open) query.value = ""
  },
)

function activate(id: string) {
  emit("update:open", false)
  emit("open", id)
}
</script>

<style scoped>
.row-time {
  min-width: 3rem;
  flex: none;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  text-align: end;
}
</style>
