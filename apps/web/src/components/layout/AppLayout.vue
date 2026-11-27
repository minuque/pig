<template>
  <div
    ref="shell"
    class="shell"
    :class="[sbClass, { 'is-narrow': isNarrow, 'is-toggling': toggling }]"
  >
    <aside
      v-if="isNarrow"
      class="drawer"
      :class="[sbState]"
      :inert="isOffcanvas"
      :aria-hidden="isOffcanvas"
    >
      <slot name="sidebar" :on-navigate="closeMobilePanels" />
    </aside>

    <Resizable
      class="shell-panels"
      :controller="panels"
      :disabled="isNarrow"
      @layout-change="onLayoutChange"
      @layout-commit="onCommit"
    >
      <ResizablePanel
        id="sidebar"
        class="sidebar"
        :default-size="initialSize"
        :min-size="`${LEFT_PANEL_MIN}px`"
        :max-size="`${LEFT_PANEL_MAX}px`"
        collapsible
        :collapsed-size="0"
      >
        <slot v-if="!isNarrow" name="sidebar" :on-navigate="closeMobilePanels" />
      </ResizablePanel>

      <ResizableHandle>
        <template #render="{ props: part }">
          <ResizeHandle v-bind="part" class="resizer" />
        </template>
      </ResizableHandle>

      <ResizablePanel id="content" class="content" :min-size="`${CONTENT_MIN_WIDTH}px`">
        <main>
          <slot />
        </main>
      </ResizablePanel>
    </Resizable>

    <WindowControls :has-running-sessions="hasRunningSessions" />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, shallowRef, useTemplateRef, watch } from "vue"
import { useEventListener } from "@vueuse/core"
import {
  createResizableController,
  Resizable,
  ResizableHandle,
  ResizablePanel,
  type ResizableSize,
} from "@ui-sdk/vue/resizable"
import {
  CONTENT_MIN_WIDTH,
  LEFT_PANEL_MAX,
  LEFT_PANEL_MIN,
  leftPanelKey,
  persistPanelWidth,
  storedPanelWidth,
  useLeftPanel,
} from "@components/layout/hooks/use-left-panel.js"
import { ResizeHandle } from "@pig/ui/resize-handle"
import WindowControls from "@components/layout/WindowControls.vue"
import { prefersReducedMotion } from "@utils/motion.js"

defineProps<{ hasRunningSessions?: boolean | undefined }>()

defineSlots<{
  default(): unknown
  sidebar(props: { onNavigate: () => void }): unknown
}>()

const { leftOpen, sbState, setSbState, isNarrow, toggle, closeMobilePanels } = useLeftPanel()
const panels = createResizableController()
const shell = useTemplateRef("shell")
const docked = computed(() => leftOpen.value && !isNarrow.value)
const initialSize: ResizableSize = docked.value ? `${storedPanelWidth()}px` : 0
const sbClass = computed(() => `sb-${sbState.value}`)
const isOffcanvas = computed(() => sbState.value === "offcanvas")

provide(leftPanelKey, { leftOpen, sbState, setSbState, toggle, isNarrow })

const toggling = shallowRef(false)
let settleToggle: ReturnType<typeof setTimeout> | undefined

function animateToggle(width = storedPanelWidth()) {
  const root = shell.value
  const nav = root?.querySelector<HTMLElement>(".sidebar > *")

  if (!root || prefersReducedMotion()) return
  clearTimeout(settleToggle)
  toggling.value = true
  root.classList.add("is-toggling")
  nav?.style.setProperty("min-inline-size", `${width}px`)
  settleToggle = setTimeout(
    () => {
      toggling.value = false
      nav?.style.removeProperty("min-inline-size")
    },
    Number.parseFloat(getComputedStyle(root).getPropertyValue("--duration-slow")) || 300,
  )
}

watch([docked, isNarrow], ([open, narrow], [wasOpen, wasNarrow]) => {
  if (open === wasOpen) return

  if (!narrow && !wasNarrow) animateToggle()

  if (!open) {
    panels.collapse("sidebar")
    return
  }

  panels.expand("sidebar")
  panels.resize("sidebar", `${storedPanelWidth()}px`)
})

let wasCollapsed = !docked.value

function onLayoutChange() {
  const collapsed = panels.isCollapsed("sidebar")

  if (collapsed !== wasCollapsed && !isNarrow.value && !toggling.value)
    animateToggle(LEFT_PANEL_MIN)
  wasCollapsed = collapsed
}

function onCommit(layout: number[]) {
  if (isNarrow.value) return

  if (panels.isCollapsed("sidebar")) {
    if (leftOpen.value) setSbState("offcanvas")
    return
  }

  if (!leftOpen.value) setSbState("expanded")
  persistPanelWidth(((shell.value?.clientWidth ?? 0) * (layout[0] ?? 0)) / 100)
}

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "b") return
  event.preventDefault()
  toggle()
})
</script>

<style scoped>
.shell {
  position: relative;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: var(--bg);
}

.shell-panels {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.sidebar,
.drawer {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sidebar);
  contain: layout style;
}

.shell.is-toggling :is(.sidebar, .content) {
  transition: flex-basis var(--duration-slow) var(--ease-out);
}

.sidebar:not([data-collapsed]) {
  border-inline-end: var(--border-width) solid var(--border-subtle);
}

.resizer {
  z-index: var(--z-resizer);
  align-self: stretch;
  width: 0;
}

html[data-pig-desktop-platform="darwin"] .resizer {
  margin-block-start: var(--titlebar-inset);
}

.content {
  display: flex;
  min-width: 0;
  min-height: 0;
}

main {
  position: relative;
  z-index: 0;
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}

.shell.is-narrow .resizer {
  display: none;
}

@media (max-width: 900px) {
  .shell {
    height: 100dvh;
  }

  .drawer {
    position: fixed;
    z-index: var(--z-drawer);
    inset-block: 0;
    inset-inline-start: 0;
    width: min(88vw, 360px);
    visibility: hidden;
    transform: translateX(-105%);
    transition:
      transform var(--duration-normal) var(--ease-out),
      visibility 0s linear var(--duration-normal);
    box-shadow: var(--shadow-dialog);
  }

  .drawer.expanded {
    visibility: visible;
    transform: translateX(0);
    transition:
      transform var(--duration-normal) var(--ease-out),
      visibility 0s linear;
  }
}

@media (prefers-reduced-motion: reduce) {
  .drawer {
    transition: none;
  }
}
</style>
