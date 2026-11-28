<template>
  <Startup :connect="pi.connect" :initialize="initialize">
    <AppLayout :has-running-sessions="hasRunningSessions">
      <template #sidebar="{ onNavigate }">
        <SessionNav
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @settings="openSettings()"
        />
      </template>

      <WorkbenchPane
        :session="session"
        :preset="preset"
        :focus-task="pendingTaskFocus"
        @center-change="paneCenterX = $event"
        @rail-tasks-visible-change="railTasksVisible = $event"
      />
    </AppLayout>

    <SettingsDialog
      :open="settingsOpen"
      :initial-pane="settingsPane"
      :refresh-models="pi.refreshModels"
      :archive="archiveController"
      :workspace="cwd.lastCwd.value"
      @update:open="onSettingsToggle"
    />
  </Startup>

  <Toaster />

  <NotificationStack>
    <template #avatar="{ item }">
      <ProjectIcon
        v-if="item.avatar?.kind === 'project'"
        :path="item.avatar.cwd"
        fallback="monogram"
      />

      <img
        v-else-if="item.avatar?.kind === 'brand'"
        src="/pwa-icon-192.png"
        alt=""
        class="notif-brand-icon"
      />
    </template>
  </NotificationStack>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, shallowRef, watch, watchEffect } from "vue"
import { useEventListener } from "@vueuse/core"
import { useRoute, useRouter } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import {
  NotificationStack,
  pushNotification,
  resolveNotificationsForSession,
} from "@pig/ui/notification"
import { Toaster } from "@pig/ui/toast"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"
import { hydratePreferences } from "@client/preferences.js"
import { hydrateSessionArchives } from "@client/session-archives.js"

import { useI18n } from "@i18n/index.js"
import { bindComposerPreset } from "@features/composer/index.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { provideSharedBuckets } from "@features/composer/hooks/use-session-buckets.js"
import { useSound } from "@features/click-sound/index.js"
import { provideExtensionUi } from "@features/extension-ui/index.js"
import { PANE_VIEWS, providePanelHost } from "@features/panel-host/index.js"
import { viewShortcut } from "@features/panel-host/lib/view-shortcut.js"
import SessionNav from "@features/session-nav/index.vue"
import { ProjectIcon, provideNav } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import { notifySystem, type ArchiveController } from "@features/settings/index.js"
import Startup from "@features/startup/index.vue"
import {
  createSessionHub,
  sessionTitle,
  untitledSession,
  useSessionLifecycle,
} from "@features/session/index.js"
import { prefetchHighlighter, transcriptModelsKey } from "@features/transcript-view/index.js"
import { createBackgroundPump } from "@/shell/hooks/use-background-pump.js"
import { bindDocumentTitle, setDocumentBaseTitle } from "@/shell/hooks/use-document-title.js"
import { useTaskNotices } from "@/shell/hooks/use-task-notices.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"
import { useWaitingNotices, waitingSessions } from "@/shell/hooks/use-waiting-sessions.js"

const { t } = useI18n()
const pi = useGatewayClient()

provide(transcriptModelsKey, pi.models)
bindDocumentTitle()

const cwd = useLocalWorkspaces()
const route = useRoute()
const router = useRouter()
const routeSessionId = computed(() => {
  if (route.name === "error") return undefined
  const raw = route.params.sessionId
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
})
const paneCenterX = shallowRef<number>()
const railTasksVisible = shallowRef(false)
const pendingTaskFocus = shallowRef<{ sessionId: string; taskId: string; seq: number }>()
let taskFocusSeq = 0

const sharedBuckets = provideSharedBuckets()
const hub = createSessionHub(pi)
const backgroundPump = createBackgroundPump({
  queue: useComposerQueue(sharedBuckets),
  sound: useSound(),
  send: hub.backgroundSend.send,
  transcriptFor: hub.history.transcriptFor,
  announce(id, outcome, detail) {
    if (waiting.value.has(id)) return
    const meta = pi.sessions.value.find((item) => item.id === id)
    const title = meta ? sessionTitle(meta) : untitledSession()
    const failed = outcome === "error"
    const body = failed ? detail || t("session.backgroundFailed") : t("session.backgroundDone")

    pushNotification({
      id: `turn:${id}`,
      title,
      body,
      tone: failed ? "error" : "success",
      keepUntilResolved: failed,
      sessionId: id,
      avatar: meta?.cwd ? { kind: "project", cwd: meta.cwd } : { kind: "brand" },
      actions: [{ label: t("session.openSession"), primary: true, run: () => nav.openSession(id) }],
    })

    void notifySystem({
      title,
      body,
      onClick: () => nav.openSession(id),
    })
  },
})

hub.setBackgroundIdle(backgroundPump.onIdle)

hub.setBackgroundSendError((id, message) => {
  const meta = pi.sessions.value.find((item) => item.id === id)
  const title = meta ? sessionTitle(meta) : untitledSession()
  const body = message
    ? `${t("session.backgroundSendFailed")}: ${message}`
    : t("session.backgroundSendFailed")

  pushNotification({
    id: `bg-send:${id}`,
    title,
    body,
    tone: "error",
    keepUntilResolved: true,
    sessionId: id,
    avatar: meta?.cwd ? { kind: "project", cwd: meta.cwd } : { kind: "brand" },
    actions: [{ label: t("session.openSession"), primary: true, run: () => nav.openSession(id) }],
  })

  void notifySystem({
    title,
    body,
    onClick: () => nav.openSession(id),
  })
})

const session = useSessionLifecycle(pi, cwd, {
  hub,
  sessionId: routeSessionId,
  navigate: (id) => router.replace({ name: "session", params: { sessionId: id } }),
})
const preset = bindComposerPreset(session, pi.models, pi.defaultModel)
const { settingsOpen, settingsPane, openSettings, closeSettings } = useSettingsDialog()
const host = providePanelHost(session.sessionId)
const extensionUi = provideExtensionUi(pi, session, host, {
  setTitle: setDocumentBaseTitle,
  openSession: (id) => nav.openSession(id),
})
const waiting = waitingSessions({
  sessions: pi.sessions,
  dialogs: extensionUi.dialogs,
  isReady: hub.history.isReady,
  transcriptFor: hub.history.transcriptFor,
})
const nav = provideNav(pi, cwd, session, waiting)
const hasRunningSessions = computed(
  () => nav.runningIds.value.size > 0 || session.turnPending.value,
)

hub.setTaskObserver(
  useTaskNotices({
    sessions: pi.sessions,
    activeSessionId: session.sessionId,
    railTasksVisible,
    openTask(sessionId, taskId) {
      taskFocusSeq += 1
      pendingTaskFocus.value = { sessionId, taskId, seq: taskFocusSeq }

      if (session.sessionId.value !== sessionId) nav.openSession(sessionId)
    },
  }),
)

watch(session.sessionId, (id) => {
  if (id) resolveNotificationsForSession(id, (item) => !item.id.startsWith("waiting:"))
})

watchEffect(() => {
  if (typeof document === "undefined") return
  const x =
    settingsOpen.value || paneCenterX.value === undefined
      ? "50vw"
      : `${Math.round(paneCenterX.value)}px`
  document.documentElement.style.setProperty("--toast-anchor-x", x)
})

useWaitingNotices(waiting, {
  sessions: pi.sessions,
  shownIds: computed(() => [session.sessionId.value]),
  open: (id) => nav.openSession(id),
  sound: useSound(),
})

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

const isMac = /mac/i.test(navigator.platform || navigator.userAgent)

function typingIn(target: EventTarget | null) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    return target.value !== ""
  return target instanceof HTMLElement && target.isContentEditable && Boolean(target.textContent)
}

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  const view = viewShortcut(event, isMac, typingIn(event.target))

  if (!view || !session.sessionId.value) return
  const target = "to" in view ? PANE_VIEWS[view.to] : undefined

  if ("to" in view && !target) return
  event.preventDefault()

  if (target) host.showView(target)
  else if ("step" in view) host.stepView(view.step)
})

function initialize() {
  return Promise.all([session.initialize(), hydratePreferences(), hydrateSessionArchives()])
}

onMounted(() => {
  prefetchHighlighter()
})

onBeforeUnmount(() => {
  if (typeof document !== "undefined")
    document.documentElement.style.removeProperty("--toast-anchor-x")
  void hub.dispose()
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

<style scoped>
.notif-brand-icon {
  inline-size: var(--icon-xl);
  block-size: var(--icon-xl);
  object-fit: cover;
}
</style>
