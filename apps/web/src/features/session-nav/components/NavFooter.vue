<template>
  <div class="nav-footer">
    <div class="footer-actions">
      <slot name="extra" />

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="footer-btn press-scale"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('nav.settings')"
            @click="emit('settings')"
          >
            <SettingsIcon :size="15" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.settings") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="footer-btn press-scale"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('nav.search')"
            @click="emit('search')"
          >
            <MagnifierIcon :size="15" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("nav.search") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <IconButton
            class="footer-btn press-scale"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('session.addGuide')"
            @click="emit('addProject')"
          >
            <AddFolderIcon :size="15" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ t("session.addGuide") }}</TooltipContent>
      </Tooltip>
    </div>

    <div class="status-list">
      <Tooltip v-for="item in statusItems" :key="item.status">
        <TooltipTrigger as-child>
          <button
            class="status-btn press-scale"
            type="button"
            :aria-label="`${item.label} · ${item.count}`"
            @click="emit('cycle', item.status)"
          >
            <SessionStateIcon :state="item.status" />
            <span class="status-count">{{ item.count }}</span>
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ item.label }} · {{ item.count }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { useI18n } from "@i18n/index.js"
import { AddFolderIcon, MagnifierIcon, SettingsIcon } from "@components/icons/index.js"
import SessionStateIcon from "@features/session-nav/components/SessionStateIcon.vue"
import { FOOTER_STATUSES, type FooterStatus } from "@features/session-nav/lib/status-cycle.js"

const props = defineProps<{
  counts: Record<FooterStatus, number>
}>()
const emit = defineEmits<{
  settings: []
  search: []
  addProject: []
  cycle: [status: FooterStatus]
}>()
const { t } = useI18n()
const LABELS: Record<FooterStatus, string> = {
  running: "session.running",
  unread: "session.unread",
  draft: "session.draft",
}
const statusItems = computed(() =>
  FOOTER_STATUSES.map((status) => ({
    status,
    count: props.counts[status],
    label: t(LABELS[status]),
  })).filter((item) => item.count > 0),
)
</script>

<style scoped>
.nav-footer {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  padding: var(--space-xs) var(--nav-inline, var(--space-xs));
}

.footer-actions,
.status-list {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
}

.status-list {
  margin-inline-start: auto;
}

/* 状态入口：图标加计数，点一次换下一个同状态会话 */
.status-btn {
  display: inline-flex;
  gap: var(--space-xxs);
  align-items: center;
  height: var(--size-icon-button);
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-caption);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}

.status-btn:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.status-count {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .status-btn {
    transition: none;
  }
}
</style>
