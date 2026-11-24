import { computed, inject, onBeforeUnmount, readonly, ref, type InjectionKey, type Ref } from "vue"
import { readPref, writePref } from "@utils/storage.js"

export type SidebarState = "expanded" | "offcanvas"

export const leftPanelKey: InjectionKey<{
  leftOpen: Readonly<Ref<boolean>>
  sbState: Readonly<Ref<SidebarState>>
  toggle: () => void
  setSbState: (s: SidebarState) => void
  isNarrow: Readonly<Ref<boolean>>
}> = Symbol("left-panel")

export function useLeftPanelToggle() {
  const ctx = inject(leftPanelKey)

  if (!ctx) throw new Error("useLeftPanelToggle() 需要在 AppLayout 内调用")
  return ctx
}

export const LEFT_PANEL_WIDTH_KEY = "pig.leftPanelWidth"
export const LEFT_PANEL_STATE_KEY = "pig.leftPanelState"
export const LEFT_PANEL_MIN = 240
export const LEFT_PANEL_MAX = 420
export const CONTENT_MIN_WIDTH = 332

export function storedPanelWidth(): number {
  const stored = Number(readPref(LEFT_PANEL_WIDTH_KEY) ?? "")
  const width = Number.isFinite(stored) && stored > 0 ? stored : window.innerWidth * 0.18
  return Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, Math.round(width)))
}

export function persistPanelWidth(width: number) {
  writePref(LEFT_PANEL_WIDTH_KEY, String(Math.round(width)))
}

export function useLeftPanel() {
  const narrowViewport = matchMedia("(max-width: 900px)")
  const sbState = ref<SidebarState>(
    narrowViewport.matches || readPref(LEFT_PANEL_STATE_KEY) === "offcanvas"
      ? "offcanvas"
      : "expanded",
  )
  const leftOpen = computed(() => sbState.value !== "offcanvas")
  const isNarrow = ref(narrowViewport.matches)
  let preNarrowState: SidebarState | undefined

  function setSbState(next: SidebarState) {
    sbState.value = next
    writePref(LEFT_PANEL_STATE_KEY, next)
  }

  function toggle() {
    setSbState(sbState.value === "expanded" ? "offcanvas" : "expanded")
  }

  function closeMobilePanels() {
    if (narrowViewport.matches) setSbState("offcanvas")
  }

  function handleViewportChange(event: MediaQueryListEvent) {
    isNarrow.value = event.matches

    if (event.matches) {
      preNarrowState = sbState.value
      setSbState("offcanvas")
    } else {
      setSbState(preNarrowState ?? "expanded")
      preNarrowState = undefined
    }
  }

  narrowViewport.addEventListener("change", handleViewportChange)
  onBeforeUnmount(() => narrowViewport.removeEventListener("change", handleViewportChange))
  return {
    leftOpen: readonly(leftOpen),
    sbState: readonly(sbState),
    setSbState,
    isNarrow: readonly(isNarrow),
    toggle,
    closeMobilePanels,
  }
}
