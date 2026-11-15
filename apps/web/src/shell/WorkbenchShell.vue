<template>
  <Startup :connect="pi.connect" :initialize="session.initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate }">
        <SessionNav
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @settings="openSettings()"
        />
      </template>

      <!-- 头部在面板之上横跨整个工作区，右侧按钮贴窗口右边 -->
      <WorkbenchHeader
        :class="{ 'is-overlay': session.welcome.value }"
        :rail="!session.welcome.value"
      />

      <FilePane>
        <RouterView />
      </FilePane>
    </AppLayout>

    <SettingsDialog
      :open="settingsOpen"
      :initial-pane="settingsPane"
      :refresh-models="pi.refreshModels"
      @update:open="onSettingsToggle"
    />

    <ExtensionUi />
  </Startup>

  <AlertToaster />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import AlertToaster from "@components/layout/AlertToaster.vue"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"

import ExtensionUi from "@features/extension-ui/index.vue"
import FilePane from "@features/file-pane/index.vue"
import { provideFilePane } from "@features/file-pane/index.js"
import { provideExtensionUi } from "@features/extension-ui/index.js"
import { provideSessionRail } from "@features/session-rail/index.js"
import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import Startup from "@features/startup/index.vue"
import { createSessionHub, provideSession, useSessionLifecycle } from "@features/session/index.js"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import { prefetchHighlighter } from "@features/transcript-view/index.js"

const pi = useGatewayClient()
const cwd = useLocalWorkspaces()
const route = useRoute()
const router = useRouter()
const routeSessionId = computed(() => {
  const raw = route.params.sessionId
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
})
const hub = createSessionHub(pi)
const session = provideSession(
  useSessionLifecycle(pi, cwd, {
    hub,
    sessionId: routeSessionId,
    navigate: (id) => router.push({ name: "session", params: { sessionId: id } }),
  }),
)
const { settingsOpen, settingsPane, openSettings, closeSettings } = useSettingsDialog()

provideNav(pi, cwd, session)

provideExtensionUi(pi, session)

provideSessionRail()

provideFilePane(session)

onMounted(() => {
  prefetchHighlighter()
})

onBeforeUnmount(() => void hub.dispose())

function onSettingsToggle(open: boolean) {
  if (open) openSettings()
  else closeSettings()
}

function handleSidebarNavigate(canonicalPath: string, closeMobilePanels: () => void): void {
  cwd.selectCwd(canonicalPath)
  closeMobilePanels()
}
</script>
