import { ref, type Ref } from "vue"
import { useEventListener } from "@vueuse/core"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"

const INTERACTIVE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "button",
  "[contenteditable='true']",
  "[role='dialog']",
  "[aria-modal='true']",
].join(", ")

export interface ShortcutKeyEvent {
  key: string
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  isComposing?: boolean | undefined
  defaultPrevented: boolean
  preventDefault(): void
  stopPropagation(): void
}

export interface ComposerShortcutsOptions {
  menuOpen(): boolean
  closeMenu(): void
  cancelQueueEdit?(): boolean
  abort?(): boolean
  hasText(): boolean
  blur(): void
  focus(): void
  pasteFiles(files: File[]): void
  atStart(): boolean
  atEnd(): boolean
  historyPrev(): void
  historyNext(): void
}

export interface ComposerShortcutsApi {
  steerHeld: Ref<boolean>
  escape(event: ShortcutKeyEvent): boolean
  navigateHistory(event: ShortcutKeyEvent): boolean
  trackModifiers(event: ShortcutKeyEvent): void
  releaseModifiers(): void
  onKeydown(event: ShortcutKeyEvent): boolean
}

export function shouldSubmitOnKeydown(e: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing
}

export function createComposerShortcuts(options: ComposerShortcutsOptions): ComposerShortcutsApi {
  const steerHeld = ref(false)

  function trackModifiers(event: ShortcutKeyEvent) {
    steerHeld.value = event.metaKey || event.ctrlKey
  }

  function releaseModifiers() {
    steerHeld.value = false
  }

  function navigateHistory(event: ShortcutKeyEvent): boolean {
    if (event.isComposing || event.shiftKey || event.altKey) return false

    if (event.metaKey || event.ctrlKey) return false

    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return false
    const backwards = event.key === "ArrowUp"

    if (backwards ? !options.atStart() : !options.atEnd()) return false
    event.preventDefault()

    if (backwards) options.historyPrev()
    else options.historyNext()
    return true
  }

  function escape(event: ShortcutKeyEvent): boolean {
    if (event.key !== "Escape" || event.isComposing) return false

    if (options.menuOpen()) {
      event.preventDefault()
      event.stopPropagation()
      options.closeMenu()
      return true
    }

    if (options.cancelQueueEdit?.()) {
      event.preventDefault()
      return true
    }

    if (options.abort?.()) {
      event.preventDefault()
      return true
    }

    if (options.hasText()) return false
    event.preventDefault()
    options.blur()
    return true
  }

  function onKeydown(event: ShortcutKeyEvent): boolean {
    return navigateHistory(event) || escape(event)
  }

  return { steerHeld, escape, navigateHistory, trackModifiers, releaseModifiers, onKeydown }
}

function focusIsFree(): boolean {
  const selection = window.getSelection()

  if (selection && !selection.isCollapsed) return false
  const active = document.activeElement
  return !(active instanceof Element && active.closest(INTERACTIVE_SELECTOR))
}

export function useComposerShortcuts(options: ComposerShortcutsOptions): ComposerShortcutsApi {
  const shortcuts = createComposerShortcuts(options)

  function onWindowKeydown(event: KeyboardEvent) {
    shortcuts.trackModifiers(event)

    if (event.defaultPrevented || event.isComposing) return

    if (event.altKey || event.metaKey || event.ctrlKey) return

    if (event.key.length !== 1 || !focusIsFree()) return
    options.focus()
  }

  function onWindowPaste(event: ClipboardEvent) {
    if (!focusIsFree()) return
    const files = clipboardFiles(event.clipboardData)

    options.focus()

    if (!files.length) return
    event.preventDefault()
    options.pasteFiles(files)
  }

  useEventListener(window, "keydown", onWindowKeydown, { capture: true })
  useEventListener(window, "keyup", shortcuts.trackModifiers)
  useEventListener(window, "paste", onWindowPaste)
  useEventListener(window, "blur", shortcuts.releaseModifiers)
  useEventListener(document, "visibilitychange", shortcuts.releaseModifiers)
  return shortcuts
}
