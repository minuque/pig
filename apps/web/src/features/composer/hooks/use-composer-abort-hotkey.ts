import { useEventListener } from "@vueuse/core"

interface AbortHotkeyOptions {
  running(): boolean
  stopping(): boolean
  blocked(): boolean
  menuOpen(): boolean
  abort(): void
}

const PANEL_SELECTOR = [
  "[data-slot='dialog-content']",
  "[data-slot='alert-dialog-content']",
  "[data-slot='dropdown-menu-content']",
  "[data-slot='context-menu-content']",
].join(", ")

export function useComposerAbortHotkey(options: AbortHotkeyOptions) {
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.isComposing) return

    if (event.altKey || event.ctrlKey || event.metaKey) return

    if (options.blocked() || !options.running() || options.stopping()) return

    if (options.menuOpen()) return
    const active = document.activeElement

    if (active instanceof Element && active.closest(PANEL_SELECTOR)) return

    event.preventDefault()
    event.stopPropagation()
    options.abort()
  }

  useEventListener(window, "keydown", onKeydown, { capture: true })
}
