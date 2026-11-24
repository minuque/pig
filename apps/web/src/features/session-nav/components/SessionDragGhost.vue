<template>
  <Teleport to="body">
    <div
      v-if="ghost"
      class="drag-ghost"
      :style="{ transform: `translate(${ghost.x + 12}px, ${ghost.y + 12}px)` }"
    >
      <MessageSquareIcon class="size-icon" />
      <span class="drag-ghost-title">{{ ghost.title }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { MessageSquareIcon } from "@components/icons/index.js"
import type { DragGhost } from "@features/session-nav/hooks/use-session-drop-out.js"

defineProps<{ ghost: DragGhost | null }>()
</script>

<style scoped>
.drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-drag);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  max-width: 240px;
  height: var(--control-sm);
  padding-inline: var(--space-xs);
  border-radius: var(--radius-control);
  background: var(--bg-raised);
  box-shadow: var(--shadow-popover);
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  pointer-events: none;
}

.drag-ghost-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
