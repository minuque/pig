<template>
  <TooltipProvider>
    <Startup :connect="pi.connect" :initialize="session.initialize">
      <AppLayout>
        <template #sidebar="{ onNavigate }">
          <SettingsNav v-if="isSettings" />
          <SessionNav v-else @navigate="handleSidebarNavigate($event, onNavigate)" />
        </template>

        <RouterView />
      </AppLayout>
    </Startup>

    <AlertToaster />
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useRoute } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import AlertToaster from "@components/layout/AlertToaster.vue"
import { TooltipProvider } from "@components/ui/tooltip/index.js"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { usePiClient } from "@client/pi-client.js"

import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import { provideSettings } from "@features/settings/index.js"
import SettingsNav from "@features/settings/components/SettingsNav.vue"
import Startup from "@features/startup/index.vue"
import { provideSession } from "@features/session-workbench/index.js"
import { prefetchHighlighter } from "@features/transcript-view/index.js"

const pi = usePiClient()
const cwd = useLocalWorkspaces()
const session = provideSession(pi, cwd)
const route = useRoute()
/** 设置路由下侧栏换成设置导航，会话导航让位，不折叠。 */
const isSettings = computed(() => route.path.startsWith("/settings"))

provideNav(pi, cwd, session)

provideSettings()

onMounted(() => {
  prefetchHighlighter()
})

function handleSidebarNavigate(canonicalPath: string, closeMobilePanels: () => void): void {
  cwd.selectCwd(canonicalPath)
  closeMobilePanels()
}
</script>
