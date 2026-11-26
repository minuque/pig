<template>
  <Startup :connect="pi.connect" :initialize="initialize">
    <AppLayout>
      <template #sidebar="{ onNavigate }">
        <SessionNav
          @navigate="handleSidebarNavigate($event, onNavigate)"
          @settings="openSettings()"
        />
      </template>

      <div
        ref="area"
        class="split-area"
        :class="{ 'is-split': sideBySide }"
        :style="sideBySide ? { '--split-left': `${split.state.value.ratio * 100}%` } : undefined"
      >
        <Resizable class="split-panels" :layout="layout" @layout-change="onLayoutChange">
          <ResizablePanel id="split-left" class="split-panel">
            <WorkbenchPane v-show="leftShown" side="left" :session="left" :preset="leftPreset" />
          </ResizablePanel>

          <ResizableHandle v-if="sideBySide">
            <template #render="{ props: part }">
              <ResizeHandle v-bind="part" class="split-resizer" @dblclick="split.setRatio(0.5)" />
            </template>
          </ResizableHandle>

          <ResizablePanel v-if="split.split.value" id="split-right" class="split-panel">
            <WorkbenchPane
              v-show="rightShown"
              side="right"
              :session="right"
              :preset="rightPreset"
            />
          </ResizablePanel>
        </Resizable>

        <div class="split-drop" aria-hidden="true">
          <div
            v-for="zone in dropZones"
            :key="zone"
            class="split-drop-zone"
            v-bind="sessionDropTargetAttrs"
            @pig-session-drop="onSessionDrop(zone, $event)"
          >
            <span class="split-drop-label">
              <Columns2Icon class="split-drop-icon" />
              {{ t("split.dropHere") }}
            </span>
          </div>
        </div>
      </div>
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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, useTemplateRef } from "vue"
import { useEventListener, useResizeObserver } from "@vueuse/core"
import { useRoute, useRouter } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import { ResizeHandle } from "@pig/ui/resize-handle"
import { Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/vue/resizable"
import { Toaster, notify } from "@pig/ui/toast"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"
import { hydratePreferences } from "@client/preferences.js"
import { hydrateSessionArchives } from "@client/session-archives.js"

import { Columns2Icon } from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import { sessionDropTargetAttrs, type DroppedSession } from "@features/session-nav/index.js"
import { bindComposerPreset } from "@features/composer/index.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { provideSharedBuckets } from "@features/composer/hooks/use-session-buckets.js"
import { useSound } from "@features/click-sound/index.js"
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
import { focusedSession, provideSplitView, type Side } from "@features/split-view/index.js"
import { splitShortcut, viewShortcut } from "@features/split-view/lib/split-shortcut.js"
import { PANE_VIEWS } from "@features/split-view/index.js"
import { prefetchHighlighter, transcriptModelsKey } from "@features/transcript-view/index.js"
import { createBackgroundPump } from "@/shell/hooks/use-background-pump.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"
import { useWaitingNotices, waitingSessions } from "@/shell/hooks/use-waiting-sessions.js"

const { t } = useI18n()
const pi = useGatewayClient()

provide(transcriptModelsKey, pi.models)

const cwd = useLocalWorkspaces()
const route = useRoute()
const router = useRouter()
const routeSessionId = computed(() => {
  if (route.name === "error") return null
  const raw = route.params.sessionId
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
})
const split = provideSplitView(routeSessionId, (id) => {
  void router.replace(id ? { name: "session", params: { sessionId: id } } : "/")
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

const sideSession = (side: Side) =>
  useSessionLifecycle(pi, cwd, {
    hub,
    sessionId: computed(() =>
      side === "left" || split.split.value ? split.state.value[side] : undefined,
    ),
    navigate: (id) => split.showIn(side, id),
  })
const left = sideSession("left")
const right = sideSession("right")
const leftPreset = bindComposerPreset(left, pi.models, pi.defaultModel)
const rightPreset = bindComposerPreset(right, pi.models, pi.defaultModel)
const onSide = (side: Side) => (side === "right" ? right : left)
const focused = focusedSession(
  () => onSide(split.focused.value),
  () =>
    split.split.value
      ? onSide(split.focused.value === "left" ? "right" : "left")
      : onSide(split.focused.value),
  split.leaveSession,
)
const { settingsOpen, settingsPane, openSettings, closeSettings } = useSettingsDialog()
const extensionUi = provideExtensionUi(pi, focused, split)
const waiting = waitingSessions({
  sessions: pi.sessions,
  dialogs: extensionUi.dialogs,
  isReady: hub.history.isReady,
  transcriptFor: hub.history.transcriptFor,
})
const nav = provideNav(pi, cwd, focused, waiting)

useWaitingNotices(waiting, {
  sessions: pi.sessions,
  shownIds: focused.shownIds,
  open: (id) => nav.openSession(id),
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
const sideBySide = computed(() => split.split.value && split.fits.value)
const leftShown = computed(() => sideBySide.value || split.focused.value === "left")
const rightShown = computed(() => sideBySide.value || split.focused.value === "right")
const area = useTemplateRef("area")
const layout = computed(() => {
  if (!split.split.value) return [100]

  if (!sideBySide.value) return leftShown.value ? [100, 0] : [0, 100]
  const left = split.state.value.ratio * 100
  return [left, 100 - left]
})

useResizeObserver(area, ([entry]) => {
  if (entry) split.setWidth(entry.contentRect.width)
})

function onLayoutChange(next: number[]) {
  if (sideBySide.value && next[0] !== undefined) split.setRatio(next[0] / 100)
}

const isMac = /mac/i.test(navigator.platform || navigator.userAgent)

function typingIn(target: EventTarget | null) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    return target.value !== ""
  return target instanceof HTMLElement && target.isContentEditable && Boolean(target.textContent)
}

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  const view = viewShortcut(event, isMac, typingIn(event.target))
  const target = view && ("to" in view ? PANE_VIEWS[view.to] : undefined)

  if (view && ("step" in view || target) && onSide(split.focused.value).sessionId.value) {
    event.preventDefault()
    return target
      ? split.showView(split.focused.value, target)
      : "step" in view && split.stepView(split.focused.value, view.step)
  }

  const command = splitShortcut(event, isMac)

  if (!command) return
  event.preventDefault()

  if (command === "new-right") return split.newOnRight()

  if (!split.split.value) return

  if (command === "close") return split.closeSide(split.focused.value)
  split.focusSide(split.focused.value === "left" ? "right" : "left")
})

const dropZones: Side[] = ["left", "right"]

function onSessionDrop(zone: Side, event: Event) {
  const id = (event as CustomEvent<readonly DroppedSession[]>).detail[0]?.id

  if (!id) return

  if (zone === split.focused.value) split.openInFocused(id)
  else split.openToSide(id)
}

function initialize() {
  return Promise.all([
    left.initialize(),
    right.initialize(),
    hydratePreferences(),
    hydrateSessionArchives(),
  ])
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

<style scoped>
.split-area {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.split-panels {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.split-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.split-drop {
  position: absolute;
  inset: 0 0 50%;
  z-index: var(--z-resizer);
  display: none;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
  padding: var(--space-sm);
  padding-block-start: var(--header-height);
}

.split-area.is-split > .split-drop {
  grid-template-columns: calc(var(--split-left) - var(--space-sm)) 1fr;
}

html[data-session-dragging] .split-drop {
  display: grid;
}

.split-drop-zone {
  display: grid;
  place-items: center;
  border: var(--border-width) dashed transparent;
  border-radius: var(--radius-card);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.split-drop-zone[data-session-drop-over] {
  border-color: var(--accent-solid);
  background: var(--bg-surface);
}

.split-drop-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  pointer-events: none;
}

.split-drop-zone[data-session-drop-over] .split-drop-label {
  color: var(--accent-text);
}

.split-drop-icon {
  width: var(--icon-md);
  height: var(--icon-md);
}

.split-resizer {
  z-index: var(--z-resizer);
  width: 0;
  margin-block-start: var(--header-height);
}
</style>
