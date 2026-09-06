<template>
  <div class="group-head" :class="{ 'is-open': !collapsed }">
    <button class="group-toggle" type="button" :aria-expanded="!collapsed" @click="emit('toggle')">
      <span v-if="kind === 'directory'" class="mark icon-swap" :class="{ 'is-open': !collapsed }">
        <Folder :data-visible="collapsed" class="size-icon" />
        <FolderOpen :data-visible="!collapsed" class="size-icon" />
      </span>
      <Pin
        v-else-if="kind === 'pinned'"
        class="size-icon mark"
        :class="{ 'is-open': !collapsed }"
      />
      <Clock v-else class="size-icon mark" :class="{ 'is-open': !collapsed }" />
      <span class="group-name">{{ name }}</span>
      <span v-if="kind !== 'directory' && count !== undefined" class="group-count">
        {{ count }}
      </span>
    </button>
    <span v-if="kind === 'directory'" class="trail icon-swap">
      <span v-if="count !== undefined" class="group-count">{{ count }}</span>
      <button
        class="group-new"
        type="button"
        title="新会话"
        aria-label="在此目录新建会话"
        @click.stop="emit('create')"
      >
        <Plus class="size-icon" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { Clock, Folder, FolderOpen, Pin, Plus } from "@lucide/vue"

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
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  flex: none;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
}

.trail {
  flex: none;
  min-width: var(--size-icon);
  justify-items: end;
}

.group-new {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  line-height: 0;
}
.group-new:hover,
.group-new:focus-visible {
  color: var(--ink);
}

@media (hover: hover) {
  .trail .group-new {
    opacity: 0;
    scale: 0.25;
    filter: blur(4px);
    pointer-events: none;
  }
  .group-head:hover .trail .group-count,
  .trail:has(.group-new:focus-visible) .group-count {
    opacity: 0;
    scale: 0.25;
    filter: blur(4px);
  }
  .group-head:hover .trail .group-new,
  .trail .group-new:focus-visible {
    opacity: 1;
    scale: 1;
    filter: blur(0);
    pointer-events: auto;
  }
}

@media (hover: none) {
  .trail .group-count {
    opacity: 0;
  }
}

.group-head.is-open .group-name {
  color: var(--ink);
}
</style>
