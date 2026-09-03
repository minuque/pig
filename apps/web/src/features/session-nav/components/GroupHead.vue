<template>
  <div class="group-head" :class="{ 'is-open': !collapsed }">
    <button class="group-toggle" type="button" :aria-expanded="!collapsed" @click="emit('toggle')">
      <ChevronRight
        v-if="kind !== 'directory'"
        class="size-icon group-caret motion-turn"
        :class="{ 'is-on': !collapsed }"
      />
      <Pin v-if="kind === 'pinned'" class="size-icon pin-mark" />
      <span v-if="kind === 'directory'" class="mark icon-swap" :class="{ 'is-open': !collapsed }">
        <Folder :data-visible="collapsed" class="size-icon" />
        <FolderOpen :data-visible="!collapsed" class="size-icon" />
      </span>
      <span class="group-name">{{ name }}</span>
      <span v-if="count !== undefined" class="group-count">{{ count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, Pin } from "@lucide/vue"

withDefaults(
  defineProps<{
    name: string
    collapsed?: boolean
    kind?: "directory" | "time" | "pinned"
    count?: number | undefined
  }>(),
  { kind: "directory", count: undefined },
)

const emit = defineEmits<{
  toggle: []
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
.group-caret,
.pin-mark {
  flex: none;
  color: var(--ink-faint);
}
.pin-mark {
  color: var(--primary);
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
.group-count {
  flex: none;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
}
.group-head.is-open .group-name {
  color: var(--ink);
}
</style>
