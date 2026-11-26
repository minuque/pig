<template>
  <Startup :connect="pi.connect" :initialize="initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate }">
        <SessionNav
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @settings="openSettings()"
        />
      </template>

      <WorkbenchPane :session="session" :preset="preset" />
    </AppLayout>

    <SettingsDialog
      :open="settingsOpen"
      :initial-pane="settingsPane"
      :refresh-models="pi.refreshModels"
      :archive="archiveController"
      :workspace="cwd.lastCwd.value"
      @update:open="onSettingsToggle"
    />

    <ExtensionUi />
  </Startup>

  <Toaster />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide } from "vue"
import { useRoute, useRouter } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import { Toaster, notify } from "@pig/ui/toast"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"
import { hydratePreferences } from "@client/preferences.js"
import { hydrateSessionArchives } from "@client/session-archives.js"

import { useI18n } from "@i18n/index.js"
import { bindComposerPreset } from "@features/composer/index.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { provideSharedBuckets } from "@features/composer/hooks/use-session-buckets.js"
import { useSound } from "@features/click-sound/index.js"
import ExtensionUi from "@features/extension-ui/index.vue"
import { provideExtensionUi } from "@features/extension-ui/index.js"
import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import type { ArchiveController } from "@features/settings/index.js"
import Startup from "@features/startup/index.vue"
import {
  createSessionHub,
  sessionTitle,
  untitledSession,
  useSessionLifecycle,
} from "@features/session/index.js"
import { prefetchHighlighter, transcriptModelsKey } from "@features/transcript-view/index.js"
import { createBackgroundPump } from "@/shell/hooks/use-background-pump.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"

const { t } = useI18n()
const pi = useGatewayClient()

provide(transcriptModelsKey, pi.models)

const cwd = useLocalWorkspaces()
const route = useRoute()
const router = useRouter()
const routeSessionId = computed(() => {
  if (route.name === "error") return undefined
  const raw = route.params.sessionId
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
})
const sharedBuckets = provideSharedBuckets()
const hub = createSessionHub(pi)
const backgroundPump = createBackgroundPump({
  queue: useComposerQueue(sharedBuckets),
  sound: useSound(),
  send: hub.backgroundSend.send,
  transcriptFor: hub.history.transcriptFor,
  announce(id, outcome) {
    const meta = pi.sessions.value.find((item) => item.id === id)
    const title = meta ? sessionTitle(meta) : untitledSession()
    notify(
      t(outcome === "complete" ? "session.backgroundDone" : "session.backgroundFailed"),
      outcome === "complete" ? "success" : "warning",
      { title, action: { label: t("session.openSession"), run: () => nav.openSession(id) } },
    )
  },
})

hub.setBackgroundIdle(backgroundPump.onIdle)

const session = useSessionLifecycle(pi, cwd, {
  hub,
  sessionId: routeSessionId,
  navigate: (id) => router.replace({ name: "session", params: { sessionId: id } }),
})
const preset = bindComposerPreset(session, pi.models, pi.defaultModel)
const { settingsOpen, settingsPane, openSettings, closeSettings } = useSettingsDialog()
const nav = provideNav(pi, cwd, session)
const archiveController: ArchiveController = {
  allSessions: nav.allSessions,
  settledIds: nav.settledIds,
  runningIds: nav.runningIds,
  cardFootById: nav.cardFootById,
  projectByCwd: nav.projectByCwd,
  archiveSessions: nav.archiveSessions,
  unarchiveSessions: nav.unarchiveSessions,
  deleteSessions: nav.deleteSessions,
}

provideExtensionUi(pi, session)

function initialize() {
  return Promise.all([session.initialize(), hydratePreferences(), hydrateSessionArchives()])
}

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
