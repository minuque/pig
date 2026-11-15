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
        <WorkbenchPane v-show="leftShown" class="split-left" side="left" :session="left" />

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

        <WorkbenchPane v-if="split.split.value" v-show="rightShown" side="right" :session="right" />
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

import { useLocalWorkspaces } from "@client/local-cwd.js"
import { useGatewayClient } from "@client/gateway-connection.js"

import { provideSharedBuckets } from "@features/composer/hooks/use-session-buckets.js"
import ExtensionUi from "@features/extension-ui/index.vue"
import { provideExtensionUi } from "@features/extension-ui/index.js"
import SessionNav from "@features/session-nav/index.vue"
import { provideNav } from "@features/session-nav/index.js"
import SettingsDialog from "@features/settings/components/SettingsDialog.vue"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import Startup from "@features/startup/index.vue"
import { createSessionHub, useSessionLifecycle } from "@features/session/index.js"
import { focusedSession, provideSplitView, type Side } from "@features/split-view/index.js"
import { prefetchHighlighter } from "@features/transcript-view/index.js"
import WorkbenchPane from "@/shell/WorkbenchPane.vue"

const pi = useGatewayClient()
const cwd = useLocalWorkspaces()
const route = useRoute()
const router = useRouter()
const routeSessionId = computed(() => {
  const raw = route.params.sessionId
  return typeof raw === "string" && raw.length > 0 ? raw : undefined
})
const split = provideSplitView(routeSessionId, (id) => {
  void router.replace(id ? { name: "session", params: { sessionId: id } } : "/")
})
const hub = createSessionHub(pi)
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
const focused = focusedSession(() => (split.focused.value === "right" ? right : left))
const { settingsOpen, settingsPane, openSettings, closeSettings } = useSettingsDialog()

provideSharedBuckets()

provideNav(pi, cwd, focused)

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

.split-area.is-resizing {
  cursor: col-resize;
  user-select: none;
}

.split-area.is-resizing > :deep(.workbench-pane) {
  pointer-events: none;
}

/* 照搬侧栏分隔条：不占位，从 header 下方开始响应，header 那一段留给拖窗 */
.split-resizer {
  position: relative;
  z-index: var(--z-resizer);
  flex: none;
  width: 0;
  margin-block-start: var(--header-height);
  cursor: col-resize;
  touch-action: none;
}

.split-resizer::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline: calc(-1 * var(--space-xxs));
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
  background: var(--contrast-foreground-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .split-resizer::after {
    transition: none;
  }
}
</style>
