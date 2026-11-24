<template>
  <HoverCardContent side="right" size="s" max-width="20rem" class="session-hover">
    <p class="hover-title">{{ session.title }}</p>

    <div v-if="session.cwd" class="hover-rows">
      <span class="hover-row">
        <ProjectIcon class="hover-icon" :path="session.cwd" fallback="monogram" />
        <span class="hover-text">{{ projectName }}</span>
      </span>

      <span class="hover-row">
        <FolderIcon class="hover-icon" />
        <span class="hover-text">{{ session.cwd }}</span>
      </span>
    </div>
  </HoverCardContent>
</template>

<script setup lang="ts">
import { HoverCardContent } from "@pig/ui/hover-card"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import type { SidebarSession } from "@features/session-nav/type.js"
import { FolderIcon } from "@components/icons/index.js"

defineProps<{ session: SidebarSession; projectName: string }>()
</script>

<style scoped>
.session-hover {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.hover-title {
  margin: 0;
  color: var(--fg);
  font-weight: var(--font-weight-medium);
  overflow-wrap: anywhere;
}

.hover-rows {
  display: grid;
  gap: var(--space-2xs);
  color: var(--fg-secondary);
}

.hover-row {
  display: grid;
  grid-template-columns: var(--icon-lg) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-xs);
}

.hover-icon {
  justify-self: center;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
  color: var(--fg-muted);
}

.hover-icon[data-tone] {
  justify-content: center;
  inline-size: var(--icon-lg);
  block-size: var(--icon-lg);
  padding: 0;
  border-radius: calc(var(--radius-control) / 2);
  font-size: calc(var(--text-body) - 5px);
  font-weight: var(--font-weight-bold);
  line-height: 1;
  letter-spacing: 0;
}

.hover-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
