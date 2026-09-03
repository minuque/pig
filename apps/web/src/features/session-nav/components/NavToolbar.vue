<template>
  <div class="nav-toolbar">
    <button
      class="toolbar-btn press-scale"
      type="button"
      :disabled="Boolean(creating)"
      @click="emit('newSession')"
    >
      <span class="mark">
        <SquarePen class="size-icon" />
      </span>
      <span class="label">新会话</span>
    </button>
    <button class="toolbar-btn press-scale" type="button" @click="emit('search')">
      <span class="mark">
        <Search class="size-icon" />
      </span>
      <span class="label">搜索</span>
    </button>
    <div class="grouping-row">
      <span class="grouping-label">{{ groupingLabel }}</span>
      <span class="grouping-actions">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="toolbar-icon" type="button" title="筛选">
              <span class="mark">
                <ListFilter class="size-icon" />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="select-none">
            <DropdownMenuItem @select="setGrouping('updated')">
              <span class="min-w-0 flex-1 truncate">更新时间</span>
              <Check v-if="grouping === 'updated'" :size="14" />
            </DropdownMenuItem>
            <DropdownMenuItem @select="setGrouping('project')">
              <span class="min-w-0 flex-1 truncate">项目</span>
              <Check v-if="grouping === 'project'" :size="14" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          class="toolbar-icon"
          type="button"
          :disabled="addingWorkspace"
          title="添加本地目录"
          @click="addWorkspace()"
        >
          <span class="mark">
            <FolderPlus class="size-icon" />
          </span>
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Check, FolderPlus, ListFilter, Search, SquarePen } from "@lucide/vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"

const emit = defineEmits<{
  newSession: []
  search: []
}>()

const { grouping, setGrouping, addingWorkspace, addWorkspace } = useNav()
const { creating } = useSession()
const groupingLabel = computed(() => (grouping.value === "project" ? "项目" : "更新时间"))
</script>

<style scoped>
.nav-toolbar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-inline: 2px;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}
.toolbar-btn,
.grouping-row {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 32px;
}
.toolbar-btn {
  gap: var(--spacing-xs);
  width: 100%;
  padding-inline: var(--spacing-xs);
  line-height: var(--text-body-sm--line-height);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}
.toolbar-btn:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--ink);
}
.toolbar-btn:disabled {
  opacity: 0.45;
}
.mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon);
  height: var(--size-icon);
}
.label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  line-height: var(--text-body-sm--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grouping-row {
  gap: var(--spacing-xxs);
  padding-inline: var(--spacing-xs) 0;
  overflow: hidden;
}
.grouping-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-body-sm--line-height);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grouping-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--spacing-xxs);
}
.toolbar-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.toolbar-icon:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--ink);
}
.toolbar-icon:disabled {
  opacity: 0.45;
}
@media (prefers-reduced-motion: reduce) {
  .toolbar-btn {
    transition: none;
  }
}
</style>
