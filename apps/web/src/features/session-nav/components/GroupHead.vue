<template>
  <div class="group-head">
    <button
      class="group-toggle"
      type="button"
      :aria-expanded="!collapsed"
      :aria-label="collapsed ? `展开 ${name}` : `折叠 ${name}`"
      @click="emit('toggle')"
    >
      <span class="mark" aria-hidden="true">
        <ChevronRight class="group-chevron" :class="{ expanded: !collapsed }" :size="16" />
      </span>
      <span class="group-name">{{ name }}</span>
    </button>
    <button
      class="group-new"
      type="button"
      :disabled="creating"
      aria-label="在此目录新建会话"
      title="新会话"
      @click.stop="emit('create')"
    >
      <span class="mark" aria-hidden="true">
        <Plus :size="16" />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Plus } from "lucide-vue-next"

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
.group-head,
.group-toggle,
.group-new {
  display: flex;
  align-items: center;
  line-height: 1;
}
.group-head {
  gap: 4px;
  height: 28px;
  padding-inline: 8px;
}
.group-toggle {
  gap: 4px;
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-align: left;
}
.group-toggle:hover {
  color: var(--ink);
}
.mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.group-chevron {
  color: var(--ink-faint);
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.group-chevron.expanded {
  transform: rotate(90deg);
}
.group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-new {
  flex: none;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.group-new:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
.group-new:disabled {
  opacity: 0.45;
}
@media (hover: hover) {
  .group-new {
    opacity: 0;
  }
  .group-head:hover .group-new,
  .group-new:focus-visible {
    opacity: 1;
  }
}
</style>
