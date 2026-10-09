<template>
  <div class="sessions-head" @click="canCollapse && emit('toggleCollapse')">
    <span class="sessions-label">{{ t("session.title") }}</span>

    <span class="sessions-actions" @click.stop>
      <Tooltip v-if="canFold">
        <TooltipTrigger as-child>
          <button
            class="sessions-action press-scale"
            type="button"
            :aria-label="allCollapsed ? t('nav.expandAll') : t('nav.collapseAll')"
            @click="emit('toggleAll')"
          >
            <MaximizeSquareIcon v-if="allCollapsed" class="size-icon" />
            <MinimizeSquareIcon v-else class="size-icon" />
          </button>
        </TooltipTrigger>

        <TooltipContent>
          {{ allCollapsed ? t("nav.expandAll") : t("nav.collapseAll") }}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <button
            class="sessions-action press-scale"
            type="button"
            :aria-label="t('nav.listManage')"
          >
            <SettingsMinimalisticIcon class="size-icon" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom" :side-offset="4">
          <div class="view-menu-label">{{ t("nav.view") }}</div>

          <DropdownMenuItem class="group-head-option" @select="emit('setView', 'flat')">
            <span class="view-menu-lead">
              <ListIcon class="size-icon" />
              {{ t("nav.flatList") }}
            </span>

            <span class="group-head-option-check" aria-hidden="true">
              <CheckIcon v-if="view === 'flat'" class="size-icon" />
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem class="group-head-option" @select="emit('setView', 'grouped')">
            <span class="view-menu-lead">
              <FoldersIcon class="size-icon" />
              {{ t("nav.groupByDir") }}
            </span>

            <span class="group-head-option-check" aria-hidden="true">
              <CheckIcon v-if="view === 'grouped'" class="size-icon" />
            </span>
          </DropdownMenuItem>

          <template v-if="view === 'grouped'">
            <div class="view-menu-label">{{ t("nav.sort") }}</div>

            <DropdownMenuItem class="group-head-option" @select="emit('setSort', 'manual')">
              <span class="view-menu-lead">
                <GripVerticalIcon class="size-icon" />
                {{ t("nav.manual") }}
              </span>

              <span class="group-head-option-check" aria-hidden="true">
                <CheckIcon v-if="sort === 'manual'" class="size-icon" />
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem class="group-head-option" @select="emit('setSort', 'recent')">
              <span class="view-menu-lead">
                <ClockCircleIcon class="size-icon" />
                {{ t("nav.sortByRecent") }}
              </span>

              <span class="group-head-option-check" aria-hidden="true">
                <CheckIcon v-if="sort === 'recent'" class="size-icon" />
              </span>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        v-if="canCollapse"
        class="sessions-action press-scale"
        type="button"
        :aria-expanded="!collapsed"
        :aria-label="collapsed ? t('nav.expandSessions') : t('nav.collapseSessions')"
        @click="emit('toggleCollapse')"
      >
        <AltArrowDownIcon v-if="!collapsed" class="size-icon" />
        <AltArrowRightIcon v-else class="size-icon" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import type { SidebarSort, SidebarView } from "@features/session-nav/type.js"
import {
  AltArrowDownIcon,
  AltArrowRightIcon,
  CheckIcon,
  ClockCircleIcon,
  FoldersIcon,
  GripVerticalIcon,
  ListIcon,
  MaximizeSquareIcon,
  MinimizeSquareIcon,
  SettingsMinimalisticIcon,
} from "@components/icons/index.js"

const { t } = useI18n()

defineProps<{
  view: SidebarView
  sort: SidebarSort
  allCollapsed?: boolean
  canFold?: boolean
  collapsed?: boolean
  canCollapse?: boolean
}>()

const emit = defineEmits<{
  toggleAll: []
  toggleCollapse: []
  setView: [view: SidebarView]
  setSort: [sort: SidebarSort]
}>()
</script>

<style scoped>
.sessions-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-height: var(--size-icon-button);
  padding-inline: var(--spacing-xs) var(--spacing-xxs);
  border-radius: var(--radius-md);
}

.sessions-head:hover {
  background: var(--interaction-hover);
}

.sessions-label {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-bold);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sessions-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xxs);
}

.sessions-action {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
}

.sessions-action:hover:not(:disabled),
.sessions-action:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

.sessions-action:disabled {
  opacity: var(--opacity-disabled);
}

@media (hover: hover) {
  .sessions-actions {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .sessions-head:is(:hover, :has(:focus-visible), :has([data-state="open"])) .sessions-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>

<style>
/* 菜单经 Portal 挂到 body，scoped 选不中 */
.group-head-option {
  justify-content: space-between;
}

.group-head-option-check {
  display: flex;
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
}

.view-menu-label {
  padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xxs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.view-menu-lead {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}
</style>
