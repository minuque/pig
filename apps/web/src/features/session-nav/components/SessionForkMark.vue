<template>
  <HoverCard>
    <HoverCardTrigger>
      <template #render="{ props: part }">
        <button
          v-bind="part"
          type="button"
          class="fork-mark"
          :aria-label="t('session.forkedFrom', { title: parent.title })"
          @click.prevent.stop="emit('open', parent.id)"
          @pointerdown.stop
          @pointerenter="emit('hover', true)"
          @pointerleave="emit('hover', false)"
        >
          <GitForkIcon class="size-icon-sm" />
        </button>
      </template>
    </HoverCardTrigger>

    <HoverCardContent side="top" size="s" max-width="20rem" class="fork-card" @pointerdown.stop>
      <button
        type="button"
        class="fork-row"
        :aria-label="t('session.forkedFrom', { title: parent.title })"
        @click="emit('open', parent.id)"
      >
        <GitForkIcon class="size-icon-lg fork-glyph" />

        <span class="fork-lines">
          <span class="fork-title">{{ parent.title }}</span>

          <span class="fork-meta">
            <template v-if="parent.cwd">
              <ProjectIcon class="fork-mono" :path="parent.cwd" fallback="monogram" />
              <span class="fork-text">{{ workspaceName(parent.cwd) }}</span>
            </template>

            <template v-if="parent.model">
              <VendorMark :vendor="parent.model.provider" :name="parent.model.id" :size="12" />
              <span class="fork-text">{{ parent.model.id }}</span>
            </template>

            <span class="fork-time">{{ formatRelativeTime(parent.updatedAt) }}</span>
          </span>
        </span>
      </button>
    </HoverCardContent>
  </HoverCard>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pig/ui/hover-card"
import { GitForkIcon } from "@components/icons/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import { formatRelativeTime, workspaceName } from "@features/session-nav/lib/format.js"
import type { SidebarParentSession } from "@features/session-nav/type.js"

defineProps<{ parent: SidebarParentSession }>()

const emit = defineEmits<{ open: [id: string]; hover: [hovering: boolean] }>()
const { t } = useI18n()
</script>

<style scoped>
.fork-mark {
  display: grid;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
}

.fork-mark:hover,
.fork-mark[data-open] {
  color: var(--fg);
}

.fork-card {
  inline-size: 20rem;
  padding: var(--space-2xs);
}

.fork-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  inline-size: 100%;
  padding: var(--space-2xs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg);
  text-align: start;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.fork-row:hover {
  background: var(--bg-hover);
}

.fork-row:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

.fork-glyph {
  flex: none;
  color: var(--fg-muted);
}

.fork-lines {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.fork-title {
  overflow: hidden;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fork-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.fork-mono[data-tone] {
  justify-content: center;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  padding: 0;
  border-radius: var(--radius-min);
  font-size: calc(var(--text-body) - 6px);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.fork-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fork-time {
  flex: none;
  margin-inline-start: auto;
  padding-inline-start: var(--space-xs);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
