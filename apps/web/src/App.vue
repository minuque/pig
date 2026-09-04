<template>
  <Startup :connect="pi.connect" :initialize="session.initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate, collapsed, toggle }">
        <SessionNav
          :collapsed="collapsed"
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @toggle="toggle"
        />
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

// 提供侧边栏导航能力，依赖当前工作目录与会话状态
provideNav(pi, cwd, session)
// 提供设置能力
provideSettings()
// 点击侧边栏项时切换工作目录，并收起移动端面板
function handleSidebarNavigate(canonicalPath: string, closeMobilePanels: () => void): void {
  cwd.selectCwd(canonicalPath)
  closeMobilePanels()
}
</script>
