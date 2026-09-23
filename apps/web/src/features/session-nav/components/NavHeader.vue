<template>
  <div class="logo-row">
    <RouterLink to="/" class="logo-mark">
      <img src="/pwa-icon-192.png" alt="" width="22" height="22" />
    </RouterLink>

    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="collapse-toggle"
          type="button"
          aria-label="折叠侧边栏"
          @click="emit('toggle')"
        >
          <PanelLeft class="size-icon" />
        </button>
      </TooltipTrigger>

      <TooltipContent>折叠侧边栏</TooltipContent>
    </Tooltip>
  </div>

  <div class="nav-toolbar">
    <button class="nav-action" type="button" @click="emit('create')">
      <CirclePlus class="size-icon" />
      <span class="nav-label">新建会话</span>
    </button>

    <button class="nav-action" type="button" @click="emit('search')">
      <Search class="size-icon" />
      <span class="nav-label">搜索</span>
      <kbd class="search-shortcut">Ctrl K</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from "vue-router"
import { CirclePlus, PanelLeft, Search } from "@lucide/vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"

const emit = defineEmits<{
  toggle: []
  create: []
  search: []
}>()
</script>

<style scoped>
html[data-pig-desktop-platform] .logo-row {
  background: var(--sidebar);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .logo-row :is(button, a) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--size-nav-rail);
}

html[data-pig-desktop-platform="win32"] .logo-row {
  min-height: var(--titlebar-inset);
}

.logo-mark,
.collapse-toggle {
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

.logo-mark {
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
}

.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

:is(.logo-mark, .collapse-toggle):hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.nav-toolbar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.nav-action {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: start;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.nav-action:hover {
  background: var(--hover-quiet);
}

.nav-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-shortcut {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  font: var(--text-caption-mono) / var(--text-caption-mono--line-height) var(--font-mono);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.nav-action:hover .search-shortcut,
.nav-action:focus-visible .search-shortcut {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .nav-action,
  .search-shortcut {
    transition: none;
  }
}
</style>
