<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { SessionId, WorkspaceId } from "@no-pi-no-gang/contracts";
import ResponsiveNavigation from "@/components/ResponsiveNavigation.vue";
import WorkspaceRail from "@/features/workspace/components/WorkspaceRail.vue";
import SessionSidebar from "@/features/session/components/SessionSidebar.vue";
import ConversationPanel from "@/features/conversation/components/ConversationPanel.vue";
import ProviderAuthFlow from "@/features/auth/components/ProviderAuthFlow.vue";
import { useRouteIds } from "@/router";
import { useLiveOverlayStore } from "@/features/sync/live-overlay-store";
import { useTheme, type ThemePreference } from "@/theme/use-theme";

/**
 * The three-region workbench shell. The Router owns the selected
 * Workspace/Session IDs; navigation panels move into modal sheets on narrow
 * viewports. The banner carries the stream connection status (polite status
 * region), the theme preference, and the Provider auth entry.
 */
const router = useRouter();
const { workspaceId, sessionId } = useRouteIds();
const overlayStore = useLiveOverlayStore();
const { preference, setTheme } = useTheme();

const authOpen = ref(false);

const CONNECTION_LABELS = {
  connecting: "正在连接…",
  live: "已连接",
  reconnecting: "正在重新连接…",
} as const;

const THEME_LABELS: Record<ThemePreference, string> = {
  light: "浅色",
  dark: "深色",
  system: "系统",
};

function onThemeChange(event: Event): void {
  setTheme((event.target as HTMLSelectElement).value as ThemePreference);
}

function selectWorkspace(id: WorkspaceId): void {
  void router.push({ name: "workspace", params: { workspaceId: id } });
}

function selectSession(id: SessionId): void {
  const current = workspaceId.value;
  if (current === undefined) return;
  void router.push({
    name: "session",
    params: { workspaceId: current, sessionId: id },
  });
}

function onSessionDeleted(id: SessionId): void {
  if (id !== sessionId.value) return;
  const current = workspaceId.value;
  if (current === undefined) return;
  void router.push({ name: "workspace", params: { workspaceId: current } });
}
</script>

<template>
  <div class="shell">
    <header class="shell-banner">
      <p class="shell-title">No Pi No Gang</p>
      <p class="shell-connection" role="status">
        <span
          class="badge"
          :data-tone="
            overlayStore.connection === 'live' ? 'success' : 'warning'
          "
        >
          {{ CONNECTION_LABELS[overlayStore.connection] }}
        </span>
      </p>
      <div class="shell-actions">
        <label class="theme-select">
          <span class="visually-hidden">主题</span>
          <select
            class="field"
            aria-label="主题"
            :value="preference"
            @change="onThemeChange"
          >
            <option
              v-for="(label, value) in THEME_LABELS"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="btn"
          aria-haspopup="dialog"
          @click="authOpen = true"
        >
          Provider 授权
        </button>
      </div>
    </header>

    <ResponsiveNavigation>
      <template #rail>
        <WorkspaceRail
          :active-workspace-id="workspaceId"
          @select="selectWorkspace"
        />
      </template>
      <template #sidebar>
        <SessionSidebar
          :workspace-id="workspaceId"
          :active-session-id="sessionId"
          @select="selectSession"
          @deleted="onSessionDeleted"
        />
      </template>
    </ResponsiveNavigation>

    <main class="shell-main">
      <ConversationPanel :session-id="sessionId" />
    </main>

    <ProviderAuthFlow :open="authOpen" @close="authOpen = false" />
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  height: 100%;
  grid-template-rows: auto 1fr;
  grid-template-columns: 220px 300px 1fr;
  grid-template-areas:
    "banner banner banner"
    "nav nav main";
}

@media (min-width: 901px) {
  .shell {
    grid-template-areas:
      "banner banner banner"
      "rail sidebar main";
  }

  .shell :deep(.nav-panel-rail) {
    grid-area: rail;
  }

  .shell :deep(.nav-panel-sidebar) {
    grid-area: sidebar;
  }
}

.shell :deep(.nav-toolbar) {
  grid-area: nav;
}

.shell-banner {
  grid-area: banner;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-4);
  min-height: var(--target-min);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.shell-title {
  font-weight: 600;
  font-size: var(--text-sm);
}

.shell-connection {
  margin: 0;
}

.shell-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.theme-select .field {
  width: auto;
  min-height: var(--target-min);
}

.shell-main {
  grid-area: main;
  min-width: 0;
  min-height: 0;
}
</style>
