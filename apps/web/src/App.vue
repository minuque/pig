<template>
  <Startup :connect="pi.connect" :initialize="session.initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate, toggle }">
        <SessionNav @navigate="handleSidebarNavigate($event, onNavigate)" @toggle="toggle" />
      </template>
      <RouterView />
    </AppLayout>
  </Startup>

  <Settings />
  <AlertToaster />
</template>

<script setup lang="ts">
import AppLayout from "@components/layout/AppLayout.vue"
import { AlertToaster } from "@components/ui/alert/index.js"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { usePiClient } from "@client/pi-client.js"

import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import Settings from "@features/settings/index.vue"
import { provideSettings } from "@features/settings/index.js"
import Startup from "@features/startup/index.vue"
import { provideSession } from "@features/session-workbench/index.js"

const pi = usePiClient()
const cwd = useLocalWorkspaces()
const session = provideSession(pi, cwd)

provideNav(pi, cwd, session)
provideSettings()

function handleSidebarNavigate(canonicalPath: string, closeMobilePanels: () => void): void {
  cwd.selectCwd(canonicalPath)
  closeMobilePanels()
}
</script>
