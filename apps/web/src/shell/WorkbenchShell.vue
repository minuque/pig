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
        :class="{ 'is-split': sideBySide, 'is-resizing': resizing }"
        :style="sideBySide ? { '--split-left': `${split.state.value.ratio * 100}%` } : undefined"
      >
        <WorkbenchPane
          v-show="leftShown"
          class="split-left"
          side="left"
          :session="left"
          :preset="leftPreset"
        />

        <div
          v-if="sideBySide"
          class="split-resizer"
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          :aria-valuenow="Math.round(split.state.value.ratio * 100)"
          @pointerdown="startResize"
          @dblclick="split.setRatio(0.5)"
          @keydown.left.prevent="split.setRatio(split.state.value.ratio - 0.02)"
          @keydown.right.prevent="split.setRatio(split.state.value.ratio + 0.02)"
        ></div>

        <WorkbenchPane
          v-if="split.split.value"
          v-show="rightShown"
          side="right"
          :session="right"
          :preset="rightPreset"
        />

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
      @update:open="onSettingsToggle"
    />

    <ExtensionUi />
  </Startup>

  <AlertToaster />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue"
import { useEventListener, useResizeObserver } from "@vueuse/core"
import { useRoute, useRouter } from "vue-router"
import AppLayout from "@components/layout/AppLayout.vue"
import AlertToaster from "@components/layout/AlertToaster.vue"
import { notify } from "@components/layout/notify.js"

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"

import { Columns2Icon } from "@components/icons/index.js"
import { useI18n } from "@i18n/index.js"
import { sessionDropTargetAttrs, type DroppedSession } from "@features/session-nav/index.js"
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
import Startup from "@features/startup/index.vue"
import {
  createSessionHub,
  sessionTitle,
  untitledSession,
  useSessionLifecycle,
} from "@features/session/index.js"
import { focusedSession, provideSplitView, type Side } from "@features/split-view/index.js"
import { splitShortcut } from "@features/split-view/lib/split-shortcut.js"
import { prefetchHighlighter } from "@features/transcript-view/index.js"
import { createBackgroundPump } from "@/shell/hooks/use-background-pump.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"

const { t } = useI18n()
const pi = useGatewayClient()
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
const nav = provideNav(pi, cwd, focused)

provideExtensionUi(pi, focused)

const sideBySide = computed(() => split.split.value && split.fits.value)
const leftShown = computed(() => sideBySide.value || split.focused.value === "left")
const rightShown = computed(() => sideBySide.value || split.focused.value === "right")
const area = useTemplateRef("area")
const resizing = shallowRef(false)

useResizeObserver(area, ([entry]) => {
  if (entry) split.setWidth(entry.contentRect.width)
})

function startResize(event: PointerEvent) {
  const box = area.value?.getBoundingClientRect()

  if (!box || event.button !== 0) return
  event.preventDefault()
  resizing.value = true

  const stopMove = useEventListener(window, "pointermove", (move: PointerEvent) => {
    split.setRatio((move.clientX - box.left) / box.width)
  })
  const stopUp = useEventListener(window, "pointerup", () => {
    resizing.value = false
    stopMove()
    stopUp()
  })
}

const isMac = /mac/i.test(navigator.platform || navigator.userAgent)

useEventListener(window, "keydown", (event: KeyboardEvent) => {
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
  return Promise.all([left.initialize(), right.initialize()])
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

.split-area.is-split > .split-left {
  flex: 0 0 var(--split-left);
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

.split-area.is-resizing {
  cursor: ew-resize;
  user-select: none;
}

.split-area.is-resizing > :deep(.workbench-pane) {
  pointer-events: none;
}

.split-resizer {
  position: relative;
  z-index: var(--z-resizer);
  flex: none;
  width: 0;
  margin-block-start: var(--header-height);
  cursor: ew-resize;
  touch-action: none;
}

.split-resizer::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline: calc(-1 * var(--space-2xs));
}

.split-resizer::after {
  content: "";
  position: absolute;
  top: 50%;
  inset-inline-start: 50%;
  width: 3px;
  height: 40px;
  border-radius: var(--radius-pill);
  background: var(--scrollbar-color);
  opacity: 0;
  translate: -50% -50%;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.split-resizer:hover::after,
.split-resizer:focus-visible::after {
  opacity: 1;
}

.split-area.is-resizing .split-resizer::after {
  opacity: 1;
  background: var(--fg-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .split-resizer::after {
    transition: none;
  }
}
</style>
