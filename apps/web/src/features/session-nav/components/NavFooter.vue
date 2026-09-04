<template>
  <div class="nav-footer" :class="{ 'is-collapsed': collapsed }">
    <button
      class="footer-action press-scale"
      :class="{ 'motion-pulse': hintAdd }"
      type="button"
      :disabled="addingWorkspace"
      title="新增工作区"
      @click="emit('addWorkspace')"
    >
      <Plus class="size-icon" />
    </button>
    <div v-if="!collapsed" class="mode-indicator" aria-label="会话分组方式">
      <button
        class="mode-hit"
        type="button"
        aria-label="按目录"
        :aria-pressed="grouping === 'project'"
        @click="emit('setGrouping', 'project')"
      >
        <span class="mode-indicator-dot" :class="{ active: grouping === 'project' }"></span>
      </button>
      <button
        class="mode-hit"
        type="button"
        aria-label="按更新时间"
        :aria-pressed="grouping === 'updated'"
        @click="emit('setGrouping', 'updated')"
      >
        <span class="mode-indicator-dot" :class="{ active: grouping === 'updated' }"></span>
      </button>
      <button class="mode-hit" type="button" aria-label="预留扩展" disabled>
        <span class="mode-indicator-dot future"></span>
      </button>
    </div>
    <button
      v-else
      class="footer-action press-scale"
      type="button"
      title="切换会话分组方式"
      @click="emit('setGrouping', grouping === 'project' ? 'updated' : 'project')"
    >
      <ListFilter class="size-icon" />
    </button>
    <button class="footer-action press-scale" type="button" title="设置" @click="emit('settings')">
      <Settings class="size-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ListFilter, Plus, Settings } from "@lucide/vue"
import type { SidebarGrouping } from "@features/session-nav/type.js"

defineProps<{
  grouping: SidebarGrouping
  addingWorkspace?: boolean
  collapsed?: boolean
  hintAdd?: boolean
}>()

const emit = defineEmits<{
  addWorkspace: []
  setGrouping: [grouping: SidebarGrouping]
  settings: []
}>()
</script>

<style scoped>
.nav-footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xs) var(--nav-inline, var(--spacing-xs));
  border-top: var(--border-width) solid var(--hairline);
}
.nav-footer.is-collapsed {
  flex-direction: column;
  margin-top: auto;
}
.footer-action {
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
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}
.footer-action:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--ink);
}
.footer-action:disabled {
  opacity: 0.45;
}
.mode-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--size-icon-button);
}
.mode-hit {
  display: grid;
  place-items: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  background: transparent;
}
.mode-indicator-dot {
  background: var(--hairline);
}
.mode-indicator-dot.active {
  background: var(--primary);
}
.mode-indicator-dot.future {
  opacity: 0.55;
}
@media (prefers-reduced-motion: reduce) {
  .footer-action {
    transition: none;
  }
}
</style>
