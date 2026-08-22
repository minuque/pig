<template>
  <header class="workbench-header">
    <button
      class="icon-button header-toggle"
      type="button"
      :aria-expanded="leftOpen"
      aria-label="切换工作目录导航"
      @click="emit('toggle')"
    >
      <PanelLeft :size="16" aria-hidden="true" />
    </button>
    <h1 v-if="title" id="current-title">{{ title }}</h1>
    <span v-if="title && cwd" class="header-cwd" :title="cwd">{{ workspaceName(cwd) }}</span>
    <span v-if="thinkingChip" class="header-chip">{{ thinkingChip }}</span>
    <div class="header-right">
      <p v-if="connecting && !phase" class="session-status" role="status">正在连接…</p>
      <p v-else-if="phase && phase !== 'idle'" class="session-status" role="status">
        <span
          class="status-mark"
          :style="{ color: running ? 'var(--primary)' : 'var(--ink-faint)' }"
          aria-hidden="true"
          >●</span
        >
        {{ phaseLabel(phase) }}
      </p>
      <ThemeToggle />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PanelLeft } from "lucide-vue-next";
import { UNTITLED_SESSION, workspaceName } from "@features/session-nav/format.js";
import { useNav } from "@features/session-nav/index.js";
import { useSession } from "@features/session-workbench/index.js";
import { phaseLabel } from "@features/session-workbench/components/SessionControlBar.vue";
import ThemeToggle from "@features/theme/ThemeToggle.vue";

defineProps<{
  leftOpen: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const { sessionId, projection, phase, connecting } = useSession();
const { activeWorkspaceId, lastCwd } = useNav();

const title = computed(() => projection.value?.name ?? (sessionId.value ? UNTITLED_SESSION : ""));
const cwd = computed(() =>
  sessionId.value ? (activeWorkspaceId.value ?? lastCwd.value) : undefined,
);
const running = computed(() => projection.value?.running ?? false);
const thinkingChip = computed(() => {
  const level = projection.value?.thinkingLevel;
  if (!level || level.toLowerCase() === "off") return "";
  return level;
});
</script>

<style scoped>
.workbench-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: calc(var(--size-control) + 2 * var(--spacing-xs));
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--surface);
}
.header-toggle {
  flex: none;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
}
.workbench-header h1 {
  min-width: 0;
  max-width: 40vw;
  margin: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-cwd {
  min-width: 0;
  max-width: 24vw;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header-chip {
  flex: none;
  max-width: 8rem;
  padding: 2px 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}
.header-right {
  display: flex;
  align-items: center;
  margin-left: auto;
  gap: var(--spacing-xs);
}
.header-right .session-status {
  margin: 0;
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}
.status-mark {
  font-size: var(--text-eyebrow);
}
@media (min-width: 901px) {
  .header-toggle {
    display: none;
  }
}
html[data-pig-desktop-platform] .workbench-header {
  -webkit-app-region: drag;
}
html[data-pig-desktop-platform]
  .workbench-header
  :deep(:is(button, a, input, select, textarea, [role="button"], [role="link"])) {
  -webkit-app-region: no-drag;
}
html[data-pig-desktop-platform="win32"] .workbench-header {
  min-height: var(--titlebar-inset);
  padding-right: var(--size-windows-caption);
}
@media (max-width: 520px) {
  .header-right .session-status {
    width: var(--size-control);
    overflow: hidden;
    font-size: 0;
    text-align: center;
  }
  .workbench-header .status-mark {
    font-size: var(--text-eyebrow);
  }
  .workbench-header > .header-toggle {
    padding-inline: var(--spacing-sm);
  }
}
</style>
