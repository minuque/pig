<template>
  <div class="command-scroll">
    <div class="command-body">
      <TriggerMenuList v-slot="{ state }" :aria-label="t('composer.commandMenuLabel')">
        <TriggerMenuGroup
          v-for="group in state.items as TriggerMenuDataGroup[]"
          :key="group.label ?? 'items'"
          class="command-group"
        >
          <TriggerMenuGroupLabel v-if="group.label" class="command-label">
            {{ group.label }}
          </TriggerMenuGroupLabel>

          <TriggerMenuItem
            v-for="item in group.items as TriggerMenuDataItem[]"
            :key="item.value"
            :value="item.value"
            :label="item.label"
            class="command-row"
          >
            <template v-if="rows.get(item.value)" #default>
              <component
                :is="rowIcon(rows.get(item.value)!)"
                v-bind="rowIconProps(rows.get(item.value)!)"
                class="command-icon"
                aria-hidden="true"
              />

              <span class="command-main">
                <span class="command-title">{{ item.label }}</span>

                <span
                  v-if="rows.get(item.value)?.secondary"
                  class="command-secondary"
                  :title="rows.get(item.value)?.secondary"
                >
                  {{ rows.get(item.value)?.secondary }}
                </span>
              </span>
            </template>
          </TriggerMenuItem>
        </TriggerMenuGroup>
      </TriggerMenuList>

      <TriggerMenuEmpty v-slot="{ state }" class="command-status">
        {{ state.loading ? t("composer.commandLoading") : emptyText }}
      </TriggerMenuEmpty>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue"
import { useI18n } from "@i18n/index.js"
import {
  TriggerMenuEmpty,
  TriggerMenuGroup,
  TriggerMenuGroupLabel,
  TriggerMenuItem,
  TriggerMenuList,
  type TriggerMenuDataGroup,
  type TriggerMenuDataItem,
} from "@pig/ui/trigger-menu"
import {
  SquareCodeIcon,
  FileTextIcon,
  FolderIcon,
  ZapIcon,
  MessageSquareIcon,
} from "@components/icons/index.js"
import LanguageIcon from "@components/icons/LanguageIcon.vue"
import type { CommandMenuRow } from "@features/composer/type.js"

const KIND_ICONS: Record<string, Component> = {
  skill: ZapIcon,
  builtin: SquareCodeIcon,
  directory: FolderIcon,
  session: MessageSquareIcon,
}

defineProps<{
  rows: ReadonlyMap<string, CommandMenuRow>
  emptyText: string
}>()

const { t } = useI18n()

function rowIcon(row: CommandMenuRow) {
  if (row.kind === "file") return LanguageIcon
  return row.icon ?? KIND_ICONS[row.kind ?? ""] ?? FileTextIcon
}

function rowIconProps(row: CommandMenuRow) {
  return row.kind === "file" ? { language: rowLanguage(row.title) } : {}
}

function rowLanguage(name: string): string {
  const dot = name.lastIndexOf(".")
  return (dot > 0 ? name.slice(dot + 1) : name).toLowerCase()
}
</script>

<style scoped>
.command-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.command-body {
  padding: var(--space-2xs);
}

.command-label {
  margin: 0;
  padding: var(--space-2xs) var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-semibold);
}

.command-group + .command-group {
  margin-top: var(--space-2xs);
  border-top: var(--border-width) solid var(--border-subtle);
  padding-top: var(--space-2xs);
}

.command-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  cursor: pointer;
  user-select: none;
  transition: background var(--duration-fast) var(--ease-out);
}

.command-row[data-highlighted] {
  background: var(--bg-hover);
}

.command-icon {
  flex: none;
  width: var(--icon-md);
  height: var(--icon-md);
  color: var(--fg-muted);
}

.command-main {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  flex: 1;
  min-width: 0;
}

.command-title {
  flex: none;
  font-weight: var(--font-weight-medium);
}

.command-secondary {
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-status {
  margin: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.command-status[data-empty] {
  padding: var(--space-xs) var(--space-sm);
}

@media (prefers-reduced-motion: reduce) {
  .command-row {
    transition: none;
  }
}
</style>
