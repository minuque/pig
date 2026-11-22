<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        class="archive-row"
        :data-first="isFirst ? '' : undefined"
        :data-last="isLast ? '' : undefined"
        :data-selected="selected ? '' : undefined"
        :data-disabled="row.running ? '' : undefined"
        @click="onRowClick"
      >
        <div class="row-check" @click.stop>
          <Checkbox
            :model-value="selected"
            :disabled="row.running"
            :aria-label="t('settings.archive.selectSession', { title: row.title })"
            @update:model-value="onCheckChange"
          />
        </div>

        <div class="row-main">
          <div class="row-top">
            <span class="row-title">{{ row.title }}</span>

            <span v-if="row.running" class="running-chip">
              <StatusIndicator status="running" size="s" />
              <span>{{ t("settings.archive.statusRunning") }}</span>
            </span>

            <Badge v-else-if="row.errored" color="danger" variant="soft" size="s">
              {{ t("settings.archive.statusError") }}
            </Badge>

            <Badge v-else-if="row.settled" color="success" variant="soft" size="s">
              {{ t("settings.archive.statusSettled") }}
            </Badge>
          </div>

          <div class="row-meta tabular">
            <span v-if="row.provider || row.model" class="meta-item meta-model">
              <VendorMark v-if="row.provider" :vendor="row.provider" :size="12" />
              <span>{{ row.model || row.provider }}</span>
            </span>

            <span v-if="row.messageCount > 0" class="meta-item">
              {{ t("settings.archive.messageCount", { count: row.messageCount }) }}
            </span>

            <span v-if="archived && row.archivedAt !== undefined" class="meta-item">
              {{ t("settings.archive.archivedAgo", { time: archivedAge }) }}
            </span>

            <span class="meta-item">
              {{
                archived
                  ? t("settings.archive.createdAgo", { time: createdAge })
                  : t("settings.archive.activeAgo", { time: activeAge })
              }}
            </span>
          </div>
        </div>

        <div class="row-actions" @click.stop>
          <Tooltip>
            <TooltipTrigger as-child>
              <IconButton
                size="m"
                variant="outline"
                color="neutral"
                :disabled="row.running"
                :aria-label="primaryLabel"
                @click="onPrimaryAction"
              >
                <ArchiveRestoreIcon v-if="archived" />
                <ArchiveIcon v-else />
              </IconButton>
            </TooltipTrigger>

            <TooltipContent>{{ primaryLabel }}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <IconButton
                size="m"
                variant="outline"
                color="danger"
                :disabled="row.running"
                :aria-label="t('settings.archive.deleteOne')"
                @click="emit('delete', row)"
              >
                <TrashIcon />
              </IconButton>
            </TooltipTrigger>

            <TooltipContent>{{ t("settings.archive.deleteOne") }}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </ContextMenuTrigger>

    <ContextMenuContent>
      <ContextMenuItem :disabled="row.running" @select="onPrimaryAction">
        <ArchiveRestoreIcon v-if="archived" />
        <ArchiveIcon v-else />
        {{ primaryLabel }}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem variant="destructive" :disabled="row.running" @select="emit('delete', row)">
        <TrashIcon />
        {{ t("settings.archive.deleteOne") }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { ArchiveIcon, ArchiveRestoreIcon, TrashIcon } from "@components/icons/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import { Badge } from "@components/ui/badge/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Checkbox } from "@components/ui/checkbox/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { StatusIndicator } from "@components/ui/status-indicator/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { formatRelativeAge, type ArchiveSessionRow } from "@features/settings/lib/archive-view.js"
import { useI18n } from "@i18n/index.js"

const props = defineProps<{
  row: ArchiveSessionRow
  archived: boolean
  selected: boolean
  now: number
  isFirst: boolean
  isLast: boolean
}>()
const emit = defineEmits<{
  toggleSelect: [id: string]
  archive: [id: string]
  unarchive: [id: string]
  delete: [row: ArchiveSessionRow]
}>()
const { t } = useI18n()
const primaryLabel = computed(() =>
  props.archived ? t("session.unarchive") : t("session.archive"),
)
const activeAge = computed(() => formatRelativeAge(props.row.lastActiveAt, props.now, t))
const createdAge = computed(() => formatRelativeAge(props.row.createdAt, props.now, t))
const archivedAge = computed(() =>
  props.row.archivedAt === undefined ? "" : formatRelativeAge(props.row.archivedAt, props.now, t),
)

function onRowClick(): void {
  if (!props.row.running) emit("toggleSelect", props.row.id)
}

function onCheckChange(): void {
  if (!props.row.running) emit("toggleSelect", props.row.id)
}

function onPrimaryAction(): void {
  if (props.row.running) return

  if (props.archived) emit("unarchive", props.row.id)
  else emit("archive", props.row.id)
}
</script>

<style scoped>
.archive-row {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 60px;
  padding-inline: var(--space-md);
  background-color: var(--card-surface);
  border-inline: var(--border-width) solid var(--border);
  transition: background-color var(--duration-fast) var(--ease-out);
}

.archive-row[data-first] {
  border-top: var(--border-width) solid var(--border);
  border-start-start-radius: var(--radius-card);
  border-start-end-radius: var(--radius-card);
}

.archive-row:not([data-first]) {
  box-shadow: var(--separator-top);
}

.archive-row[data-last] {
  border-bottom: var(--border-width) solid var(--border);
  border-end-start-radius: var(--radius-card);
  border-end-end-radius: var(--radius-card);
}

@media (hover: hover) {
  .archive-row:not([data-disabled]):hover {
    background-color: var(--bg-hover);
  }
}

.archive-row[data-selected] {
  background-color: var(--bg-selected);
}

.row-check {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.row-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
}

.row-top {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.row-title {
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.running-chip {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-2xs);
  color: var(--info-text);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.row-meta {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-xs);
  overflow: hidden;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-2xs);
}

.meta-item + .meta-item::before {
  content: "·";
  margin-inline-end: var(--space-2xs);
  color: var(--fg-subtle);
}

.meta-model {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
}

.meta-model > span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: var(--space-xs);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .archive-row {
    transition: none;
  }
}
</style>
