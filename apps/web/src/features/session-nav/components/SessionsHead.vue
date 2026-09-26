<template>
  <div class="sessions-head" @click="canCollapse && emit('toggleCollapse')">
    <span class="sessions-label">会话</span>

    <span class="sessions-actions" @click.stop>
      <Tooltip v-if="canFold">
        <TooltipTrigger as-child>
          <button
            class="sessions-action press-scale"
            type="button"
            :aria-label="allCollapsed ? '全部展开' : '全部折叠'"
            @click="emit('toggleAll')"
          >
            <Maximize2 v-if="allCollapsed" class="size-icon" />
            <Minimize2 v-else class="size-icon" />
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ allCollapsed ? "全部展开" : "全部折叠" }}</TooltipContent>
      </Tooltip>

      <DropdownMenu :modal="false">
        <DropdownMenuTrigger as-child>
          <button class="sessions-action press-scale" type="button" aria-label="列表管理">
            <Settings2 class="size-icon" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom" :side-offset="4">
          <div class="view-menu-label">视图</div>

          <DropdownMenuItem class="group-head-option" @select="emit('setView', 'flat')">
            <span class="view-menu-lead">
              <List class="size-icon" />
              平铺列表
            </span>

            <span class="group-head-option-check" aria-hidden="true">
              <Check v-if="view === 'flat'" class="size-icon" />
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem class="group-head-option" @select="emit('setView', 'grouped')">
            <span class="view-menu-lead">
              <FolderTree class="size-icon" />
              按工作区分组
            </span>

            <span class="group-head-option-check" aria-hidden="true">
              <Check v-if="view === 'grouped'" class="size-icon" />
            </span>
          </DropdownMenuItem>

          <template v-if="view === 'grouped'">
            <div class="view-menu-label">排序</div>

            <DropdownMenuItem class="group-head-option" @select="emit('setSort', 'manual')">
              <span class="view-menu-lead">
                <GripVertical class="size-icon" />
                手动排序
              </span>

              <span class="group-head-option-check" aria-hidden="true">
                <Check v-if="sort === 'manual'" class="size-icon" />
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem class="group-head-option" @select="emit('setSort', 'recent')">
              <span class="view-menu-lead">
                <Clock class="size-icon" />
                按最近活动
              </span>

              <span class="group-head-option-check" aria-hidden="true">
                <Check v-if="sort === 'recent'" class="size-icon" />
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
        :aria-label="collapsed ? '展开会话' : '折叠会话'"
        @click="emit('toggleCollapse')"
      >
        <ChevronDown v-if="!collapsed" class="size-icon" />
        <ChevronRight v-else class="size-icon" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderTree,
  GripVertical,
  List,
  Maximize2,
  Minimize2,
  Settings2,
} from "@lucide/vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import type { SidebarSort, SidebarView } from "@features/session-nav/type.js"

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
