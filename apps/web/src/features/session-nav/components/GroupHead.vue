<template>
  <div class="group-head" :class="{ 'is-open': !collapsed }">
    <button class="group-toggle" type="button" @click="emit('toggle')">
      <span class="mark icon-swap" :class="{ 'is-open': !collapsed }">
        <Folder :stroke-width="1.5" :data-visible="collapsed" class="size-icon" />
        <FolderOpen :stroke-width="1.5" :data-visible="!collapsed" class="size-icon" />
      </span>
      <span class="group-name">{{ name }}</span>
    </button>
    <button
      class="group-new"
      type="button"
      :disabled="creating"
      title="新会话"
      @click.stop="emit('create')"
    >
      <Plus class="size-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { Folder, FolderOpen, Plus } from "@lucide/vue"

defineProps<{
  name: string
  collapsed?: boolean
  creating?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  create: []
}>()
</script>

<style scoped>
.group-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 32px;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
}
.group-head:hover {
  background: var(--hover-quiet);
}
.group-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  flex: 1;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}
.mark {
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  color: var(--ink-faint);
  transition: color var(--duration-fast) var(--ease-smooth);
}
.group-head:hover .mark {
  color: var(--ink-muted);
}
.mark.is-open,
.group-head:hover .mark.is-open {
  color: var(--primary);
}
.group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-md--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-head.is-open .group-name {
  color: var(--ink);
}
.group-new {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon);
  height: var(--size-icon);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  line-height: 0;
  opacity: 0;
  pointer-events: none;
}
.group-head:hover .group-new,
.group-new:focus-visible {
  opacity: 1;
  pointer-events: auto;
}
.group-new:hover:not(:disabled),
.group-new:focus-visible:not(:disabled) {
  color: var(--ink);
}
.group-head:hover .group-new:disabled {
  opacity: 0.45;
  pointer-events: none;
}
</style>
