<template>
  <div class="nav-toolbar">
    <button
      class="toolbar-btn"
      type="button"
      :disabled="Boolean(creating)"
      aria-label="新会话"
      @click="emit('newSession')"
    >
      <span class="mark" aria-hidden="true">
        <SquarePen :size="16" />
      </span>
      <span class="label">新会话</span>
    </button>
    <Popover v-model:open="searchOpen">
      <PopoverTrigger as-child>
        <button class="toolbar-btn" type="button" :aria-expanded="searchOpen" aria-label="搜索会话">
          <span class="mark" aria-hidden="true">
            <Search :size="16" />
          </span>
          <span class="label">{{ searching ? searchQuery : "搜索" }}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        :side-offset="4"
        class="w-(--reka-popover-trigger-width) p-(--spacing-xxs)"
        aria-label="搜索会话"
        @open-auto-focus="onOpenAutoFocus"
      >
        <label class="search-field">
          <span class="mark" aria-hidden="true">
            <Search :size="16" />
          </span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="search-input"
            type="search"
            placeholder="搜索会话"
            aria-label="搜索会话"
            autocomplete="off"
          />
        </label>
      </PopoverContent>
    </Popover>
    <div class="grouping-row">
      <span class="grouping-label">{{ groupingLabel }}</span>
      <span class="grouping-actions">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="toolbar-icon" type="button" aria-label="筛选会话分组" title="筛选">
              <span class="mark" aria-hidden="true">
                <ListFilter :size="16" />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="select-none">
            <DropdownMenuItem @select="setGrouping('updated')">
              <span class="min-w-0 flex-1 truncate">更新时间</span>
              <Check v-if="grouping === 'updated'" :size="14" aria-hidden="true" />
            </DropdownMenuItem>
            <DropdownMenuItem @select="setGrouping('project')">
              <span class="min-w-0 flex-1 truncate">项目</span>
              <Check v-if="grouping === 'project'" :size="14" aria-hidden="true" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          class="toolbar-icon"
          type="button"
          :disabled="addingWorkspace"
          aria-label="添加本地目录"
          title="添加本地目录"
          @click="addWorkspace()"
        >
          <span class="mark" aria-hidden="true">
            <FolderPlus :size="16" />
          </span>
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue"
import { Check, FolderPlus, ListFilter, Search, SquarePen } from "lucide-vue-next"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Popover, PopoverContent, PopoverTrigger } from "@components/ui/popover/index.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"

const searchQuery = defineModel<string>("searchQuery", { default: "" })

const emit = defineEmits<{
  newSession: []
}>()

const { grouping, setGrouping, addingWorkspace, addWorkspace } = useNav()
const { creating } = useSession()

const searchOpen = shallowRef(false)
const searchInput = useTemplateRef<HTMLInputElement>("searchInput")
const searching = computed(() => searchQuery.value.trim() !== "")
const groupingLabel = computed(() => (grouping.value === "project" ? "项目" : "更新时间"))

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  void nextTick(() => searchInput.value?.focus())
}
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
.search-field,
.grouping-row {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 32px;
  padding-inline: 8px;
  line-height: 1;
}
.toolbar-btn,
.search-field {
  gap: 8px;
}
.toolbar-btn {
  width: 100%;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
}
.toolbar-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.toolbar-btn:disabled {
  opacity: 0.45;
}
.mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.label,
.grouping-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-field {
  width: 100%;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink-muted);
  cursor: text;
}
.search-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-sm);
  appearance: none;
  user-select: text;
}
.search-input::placeholder {
  color: var(--ink-faint);
}
.search-input::-webkit-search-cancel-button {
  display: none;
}
.grouping-row {
  gap: 4px;
  padding-inline-end: 0;
}
.grouping-label {
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  text-align: left;
}
.grouping-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}
.toolbar-icon {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.toolbar-icon:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
.toolbar-icon:disabled {
  opacity: 0.45;
}
</style>
