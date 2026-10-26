<template>
  <Startup :connect="pi.connect" :initialize="session.initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate }">
        <SessionNav
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @settings="settingsOpen = true"
        />
      </template>

      <RouterView />
    </AppLayout>

    <SettingsDialog v-model:open="settingsOpen" :cwd="settingsCwd" />
  </Startup>

  <AlertToaster />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import AppLayout from "@components/layout/AppLayout.vue"
import AlertToaster from "@components/layout/AlertToaster.vue"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { usePiClient } from "@client/pi-client.js"

import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useSettingsCwd } from "@features/settings/hooks/use-settings-cwd.js"
import Startup from "@features/startup/index.vue"
import { provideSession } from "@features/session-workbench/index.js"
import { prefetchHighlighter } from "@features/transcript-view/index.js"

const pi = usePiClient()
const cwd = useLocalWorkspaces()
const session = provideSession(pi, cwd)
const settingsOpen = ref(false)
const nav = provideNav(pi, cwd, session)
/** 设置里的资源页要的 cwd：当前会话 → 偏好 → 列表里第一条。 */
const settingsCwd = useSettingsCwd(nav)

onMounted(() => {
  prefetchHighlighter()
})

function handleSidebarNavigate(canonicalPath: string, closeMobilePanels: () => void): void {
  cwd.selectCwd(canonicalPath)
  closeMobilePanels()
}
</script>
