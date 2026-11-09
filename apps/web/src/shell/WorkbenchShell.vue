<template>
  <Startup :connect="pi.connect" :initialize="session.initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate }">
        <SessionNav
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @settings="openSettings()"
        />
      </template>

      <RouterView />
    </AppLayout>

    <SettingsDialog
      :open="settingsOpen"
      :initial-pane="settingsPane"
      :refresh-models="pi.refreshModels"
      @update:open="onSettingsToggle"
    />
  </Startup>

  <AlertToaster />
</template>

<script setup lang="ts">
import { onMounted } from "vue"
import AppLayout from "@components/layout/AppLayout.vue"
import AlertToaster from "@components/layout/AlertToaster.vue"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"

import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import Startup from "@features/startup/index.vue"
import { provideSession } from "@features/session-workbench/index.js"
import { prefetchHighlighter } from "@features/transcript-view/index.js"

const pi = useGatewayClient()
const cwd = useLocalWorkspaces()
const session = provideSession(pi, cwd)
const { settingsOpen, settingsPane, openSettings, closeSettings } = useSettingsDialog()

provideNav(pi, cwd, session)

onMounted(() => {
  prefetchHighlighter()
})

function onSettingsToggle(open: boolean) {
  if (open) openSettings()
  else closeSettings()
}

function handleSidebarNavigate(canonicalPath: string, closeMobilePanels: () => void): void {
  cwd.selectCwd(canonicalPath)
  closeMobilePanels()
}
</script>
