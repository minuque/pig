<template>
  <CommandPalette :open="open" :title="t('nav.search')" @update:open="emit('update:open', $event)">
    <CommandPaletteInput v-model="query" :placeholder="t('nav.searchPlaceholder')" />

    <CommandPaletteList>
      <CommandPaletteEmpty v-if="!rows.length">{{ t("nav.searchEmpty") }}</CommandPaletteEmpty>

      <CommandPaletteItem
        v-for="row in rows"
        :key="row.id"
        :value="row.id"
        class="row"
        @select="activate(row.id)"
      >
        <SquareCodeIcon class="size-icon row-icon" />
        <span class="row-title">{{ row.title }}</span>
        <span class="row-time">{{ row.time }}</span>
        <ArrowDownLeftIcon class="size-icon row-go" aria-hidden="true" />
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
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import {
  CommandPalette,
  CommandPaletteEmpty,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
} from "@components/ui/command-palette/index.js"
import { ArrowDownLeftIcon, SquareCodeIcon } from "@components/icons/index.js"

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
.row-icon {
  flex: none;
  color: var(--fg-secondary);
}

.row-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-time {
  flex: none;
  color: var(--fg-faint);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.row-go,
.row[data-highlighted] .row-time {
  display: none;
}

.row[data-highlighted] .row-go {
  display: block;
  flex: none;
}
</style>
