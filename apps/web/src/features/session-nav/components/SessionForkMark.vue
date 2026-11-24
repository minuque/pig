<template>
  <HoverCard>
    <HoverCardTrigger>
      <template #render="{ props: part }">
        <button
          v-bind="part"
          ref="mark"
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

    <HoverCardContent side="right" size="s" max-width="20rem" :anchor="rowAnchor">
      <button type="button" class="fork-link" @click="emit('open', parent.id)">
        <GitForkIcon class="size-icon-sm fork-icon" />
        <span class="fork-title">{{ t("session.forkedFrom", { title: parent.title }) }}</span>
        <ArrowUpRightIcon class="size-icon-sm fork-go" />
      </button>
    </HoverCardContent>
  </HoverCard>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@pig/ui/hover-card"
import { ArrowUpRightIcon, GitForkIcon } from "@components/icons/index.js"

defineProps<{ parent: { id: string; title: string } }>()

const emit = defineEmits<{ open: [id: string]; hover: [hovering: boolean] }>()
const { t } = useI18n()
const mark = useTemplateRef<HTMLElement>("mark")
const rowAnchor = {
  getBoundingClientRect: () =>
    (mark.value?.closest(".session-card") ?? mark.value)?.getBoundingClientRect() ?? new DOMRect(),
}
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

.fork-link {
  display: grid;
  grid-template-columns: var(--icon-lg) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-xs);
  inline-size: 100%;
  min-height: var(--control-2xs);
  margin: calc(var(--space-2xs) * -1);
  padding-inline: var(--space-2xs);
  border: 0;
  border-radius: calc(var(--radius-control) - 2px);
  background: transparent;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: start;
  cursor: pointer;
}

.fork-link:hover,
.fork-link:focus-visible {
  background: var(--bg-hover);
  color: var(--fg);
}

.fork-icon {
  justify-self: center;
  color: var(--fg-muted);
}

.fork-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fork-go {
  color: var(--fg-muted);
}
</style>
