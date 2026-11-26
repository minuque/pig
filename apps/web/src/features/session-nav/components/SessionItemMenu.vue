<template>
  <ContextMenuContent class="select-none">
    <ContextMenuItem @select="emit('rename')">
      <PenIcon />
      {{ t("session.rename") }}
    </ContextMenuItem>

    <ContextMenuItem @select="emit('togglePinned')">
      <PinOffIcon v-if="pinned" />
      <PinIcon v-else />
      {{ pinned ? t("session.unpin") : t("session.pin") }}
    </ContextMenuItem>

    <ContextMenuSeparator />

    <ContextMenuItem v-if="settled" @select="emit('unsettle')">
      <RotateCcwIcon />
      {{ t("session.unsettle") }}
    </ContextMenuItem>

    <ContextMenuItem v-else @select="emit('settle')">
      <CircleCheckIcon />
      {{ t("session.settle") }}
    </ContextMenuItem>

    <ContextMenuItem :disabled="working" @select="emit('archive')">
      <ArchiveIcon />
      {{ t("session.archive") }}
    </ContextMenuItem>

    <ContextMenuSeparator />

    <ContextMenuItem color="danger" @select="emit('delete')">
      <TrashIcon />
      {{ t("session.deleteTitle") }}
    </ContextMenuItem>
  </ContextMenuContent>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@pig/ui/context-menu"
import {
  ArchiveIcon,
  CircleCheckIcon,
  PenIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  TrashIcon,
} from "@components/icons/index.js"

defineProps<{
  sessionId: string
  pinned: boolean
  settled: boolean
  working: boolean
}>()

const emit = defineEmits<{
  rename: []
  togglePinned: []
  settle: []
  unsettle: []
  archive: []
  delete: []
}>()
const { t } = useI18n()
</script>
