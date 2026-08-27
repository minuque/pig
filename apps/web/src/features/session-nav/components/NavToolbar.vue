<template>
  <div class="nav-toolbar">
    <button
      class="toolbar-btn"
      type="button"
      :disabled="Boolean(creating)"
      aria-label="新会话"
      @click="emit('newSession')"
    >
      <SquarePen :size="16" aria-hidden="true" />
      <span>新会话</span>
    </button>
    <Popover v-model:open="searchOpen">
      <PopoverTrigger as-child>
        <button class="toolbar-btn" type="button" :aria-expanded="searchOpen" aria-label="搜索会话">
          <Search :size="16" aria-hidden="true" />
          <span class="search-label">{{ searching ? searchQuery : "搜索" }}</span>
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
          <Search :size="16" aria-hidden="true" />
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
      <button
        class="toolbar-icon"
        type="button"
        :aria-label="`当前${groupingLabel}，切换为${nextGroupingLabel}`"
        :title="`切换为${nextGroupingLabel}`"
        @click="toggleGrouping"
      >
        <Folder v-if="grouping === 'project'" :size="16" aria-hidden="true" />
        <Clock v-else :size="16" aria-hidden="true" />
      </button>
      <button
        class="toolbar-icon"
        type="button"
        :disabled="addingWorkspace"
        aria-label="添加本地目录"
        title="添加本地目录"
        @click="addWorkspace()"
      >
        <FolderPlus :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from "vue"
import { Clock, Folder, FolderPlus, Search, SquarePen } from "lucide-vue-next"
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
const nextGroupingLabel = computed(() => (grouping.value === "project" ? "更新时间" : "项目"))

function toggleGrouping() {
  setGrouping(grouping.value === "project" ? "updated" : "project")
}

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
.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
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
.search-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink-muted);
  cursor: text;
}
.search-input {
  min-width: 0;
  flex: 1;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
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
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.grouping-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toolbar-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: none;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
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
