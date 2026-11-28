<template>
  <HoverCardContent side="right" size="s" max-width="20rem" class="session-hover" @pointerdown.stop>
    <p class="hover-title">{{ session.title }}</p>

    <div class="hover-rows">
      <template v-if="session.cwd">
        <span class="hover-row">
          <ProjectIcon class="hover-icon" :path="session.cwd" fallback="monogram" />
          <span class="hover-text">{{ projectName }}</span>
        </span>

        <span class="hover-row">
          <FolderIcon class="hover-icon" />
          <span class="hover-text">{{ session.cwd }}</span>
        </span>
      </template>

      <span v-if="foot?.git" class="hover-row">
        <FolderGit2Icon v-if="foot.git.worktree" class="hover-icon" />
        <GitBranchIcon v-else class="hover-icon" />

        <span class="hover-text">
          {{
            foot.git.worktree ? `${foot.git.branch} · ${t("session.worktree")}` : foot.git.branch
          }}
        </span>
      </span>

      <span v-if="foot?.model" class="hover-row">
        <VendorMark
          class="hover-icon"
          :vendor="foot.model.provider"
          :name="foot.model.id"
          :size="14"
        />

        <span class="hover-text">{{ foot.model.id }}</span>
      </span>

      <span class="hover-row">
        <MessagesSquareIcon class="hover-icon" />
        <span class="hover-text">{{ stats }}</span>
      </span>

      <button
        v-if="foot?.parent"
        type="button"
        class="hover-row is-link"
        @click="emit('open', foot.parent.id)"
      >
        <GitForkIcon class="hover-icon" />
        <span class="hover-text">{{ t("session.forkedFrom", { title: foot.parent.title }) }}</span>
        <ArrowUpRightIcon class="hover-icon hover-go" aria-hidden="true" />
      </button>
    </div>
  </HoverCardContent>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { HoverCardContent } from "@pig/ui/hover-card"
import VendorMark from "@components/icons/VendorMark.vue"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import type { SidebarRowFoot, SidebarSession } from "@features/session-nav/type.js"
import {
  ArrowUpRightIcon,
  FolderGit2Icon,
  FolderIcon,
  GitBranchIcon,
  GitForkIcon,
  MessagesSquareIcon,
} from "@components/icons/index.js"

const props = defineProps<{
  session: SidebarSession
  projectName: string
  foot: SidebarRowFoot | undefined
}>()
const emit = defineEmits<{ open: [id: string] }>()
const { t, locale } = useI18n()
const stats = computed(() => {
  const created = t("session.cardCreated", {
    time: new Intl.DateTimeFormat(locale.value, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(props.session.createdAt),
  })
  const count = props.foot?.messageCount
  return count === undefined ? created : `${t("session.cardMessages", { count })} · ${created}`
})
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
  margin-inline: calc(var(--space-2xs) * -1);
}

.hover-row {
  display: grid;
  grid-template-columns: var(--icon-lg) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-2xs);
  padding-inline: var(--space-2xs);
  border: 0;
  border-radius: var(--radius-min);
  background: transparent;
  color: var(--fg-secondary);
  font: inherit;
  text-align: start;
}

.hover-row.is-link {
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.hover-row.is-link:is(:hover, :focus-visible) {
  background: var(--bg-hover);
  color: var(--fg);
}

.hover-icon {
  justify-self: center;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  color: var(--fg-muted);
}

.hover-icon[data-tone] {
  justify-content: center;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  padding: 0;
  border-radius: var(--radius-min);
  color: var(--tone-text);
  font-size: calc(var(--text-body) - 6px);
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

.hover-go {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.hover-row.is-link:is(:hover, :focus-visible) .hover-go {
  opacity: 1;
}
</style>
