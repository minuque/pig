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
      <Plus :size="16" aria-hidden="true" />
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
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding-inline: 8px;
  border-radius: var(--radius-md);
}
.group-head:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.group-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
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
.group-head:hover .group-chevron {
  color: var(--ink-muted);
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
  line-height: var(--text-body-md--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-new {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  line-height: 0;
  transition:
    opacity 300ms cubic-bezier(0.2, 0, 0, 1),
    scale 300ms cubic-bezier(0.2, 0, 0, 1),
    filter 300ms cubic-bezier(0.2, 0, 0, 1);
}
.group-new:hover:not(:disabled),
.group-new:focus-visible:not(:disabled) {
  color: var(--ink);
}
.group-new:disabled {
  opacity: 0.45;
}
@media (hover: hover) {
  .group-new {
    opacity: 0;
    scale: 0.25;
    filter: blur(4px);
  }
  .group-head:hover .group-new,
  .group-new:focus-visible {
    opacity: 1;
    scale: 1;
    filter: blur(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .group-new {
    transition: none;
  }
}
</style>
