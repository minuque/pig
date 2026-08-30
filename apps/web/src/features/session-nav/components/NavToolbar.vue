<template>
  <div class="nav-toolbar">
    <button
      class="toolbar-btn press-scale"
      type="button"
      :disabled="Boolean(creating)"
      @click="emit('newSession')"
    >
      <span class="mark">
        <SquarePen :size="16" />
      </span>
      <span class="label">新会话</span>
    </button>
    <div class="grouping-row">
      <span class="grouping-label" :class="{ hidden: searchExpanded }">{{ groupingLabel }}</span>
      <div
        ref="searchRoot"
        class="search"
        :class="{ expanded: searchExpanded }"
        @click="openSearch"
      >
        <button class="toolbar-icon" type="button">
          <Search :size="16" />
        </button>
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="search-input"
          type="search"
          placeholder="搜索会话"
          autocomplete="off"
          :tabindex="searchExpanded ? 0 : -1"
          @keydown.escape="closeSearch"
        />
        <button v-if="searchExpanded" class="clear-button" type="button" @click.stop="closeSearch">
          <X :size="14" />
        </button>
      </div>
      <span class="grouping-actions" :class="{ hidden: searchExpanded }">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="toolbar-icon" type="button" title="筛选">
              <span class="mark">
                <ListFilter :size="16" />
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
            <FolderPlus :size="16" />
          </span>
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue"
import { onClickOutside } from "@vueuse/core"
import { Check, FolderPlus, ListFilter, Search, SquarePen, X } from "lucide-vue-next"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"

const searchQuery = defineModel<string>("searchQuery", { default: "" })

const emit = defineEmits<{
  newSession: []
}>()

const { grouping, setGrouping, addingWorkspace, addWorkspace } = useNav()
const { creating } = useSession()

const searchExpanded = shallowRef(searchQuery.value.trim() !== "")
const searchRoot = useTemplateRef<HTMLElement>("searchRoot")
const searchInput = useTemplateRef<HTMLInputElement>("searchInput")
const groupingLabel = computed(() => (grouping.value === "project" ? "项目" : "更新时间"))

function openSearch() {
  searchExpanded.value = true
  void nextTick(() => searchInput.value?.focus({ preventScroll: true }))
}

function closeSearch() {
  searchQuery.value = ""
  searchExpanded.value = false
}

onClickOutside(searchRoot, () => {
  if (!searchExpanded.value) return
  searchInput.value?.blur()
  if (searchQuery.value.trim() !== "") return
  searchExpanded.value = false
})
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
  gap: 8px;
  width: 100%;
  padding-inline: 8px;
  line-height: 1;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
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
.label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grouping-row {
  gap: 4px;
  padding-inline: 8px 0;
  overflow: hidden;
}
.grouping-label {
  flex: none;
  max-width: 45%;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-body-sm--line-height);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    max-width var(--duration-normal) var(--ease-in-out),
    margin-inline-end var(--duration-normal) var(--ease-in-out),
    opacity var(--duration-fast) var(--ease-in-out),
    transform var(--duration-normal) var(--ease-in-out),
    visibility 0s linear;
}
.search {
  display: flex;
  flex: 1;
  align-items: center;
  max-width: 32px;
  min-width: 0;
  height: 32px;
  margin-inline-start: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  cursor: text;
  box-sizing: border-box;
  transition:
    max-width var(--duration-normal) var(--ease-in-out),
    border-color var(--duration-normal) var(--ease-in-out),
    padding var(--duration-normal) var(--ease-in-out);
}
.search.expanded {
  max-width: 100%;
  padding-inline-end: 4px;
  border-color: var(--hairline);
}
.search.expanded .toolbar-icon:hover:not(:disabled) {
  background: transparent;
}
.search-input {
  min-width: 0;
  flex: 1;
  width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-sm);
  opacity: 0;
  pointer-events: none;
  appearance: none;
  user-select: text;
  transition: opacity var(--duration-fast) var(--ease-in-out);
}
.search.expanded .search-input {
  opacity: 1;
  pointer-events: auto;
}
.search-input::placeholder {
  color: var(--ink-faint);
}
.search-input::-webkit-search-cancel-button {
  display: none;
}
.clear-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.clear-button:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
.grouping-actions {
  display: flex;
  flex: none;
  align-items: center;
  max-width: 68px;
  gap: 4px;
  overflow: hidden;
  transition:
    max-width var(--duration-normal) var(--ease-in-out),
    opacity var(--duration-fast) var(--ease-in-out),
    transform var(--duration-normal) var(--ease-in-out),
    visibility 0s linear;
}
.grouping-label.hidden,
.grouping-actions.hidden {
  max-width: 0;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.grouping-label.hidden {
  margin-inline-end: -4px;
  transform: translateX(-4px);
  transition-delay: 0s, 0s, 0s, 0s, var(--duration-normal);
}
.grouping-actions.hidden {
  transform: translateX(4px);
  transition-delay: 0s, 0s, 0s, var(--duration-normal);
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
@media (prefers-reduced-motion: reduce) {
  .toolbar-btn,
  .grouping-label,
  .search,
  .search-input,
  .grouping-actions {
    transition: none;
  }
}
</style>
