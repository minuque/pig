import { ref, watch, type Ref } from "vue"
import { FAVORITES_SCOPE } from "@features/composer/lib/model-preset.js"

function moveFocus(panel: HTMLElement, step: number): boolean {
  const items = [...panel.querySelectorAll<HTMLElement>("[data-menu-item]:not(:disabled)")]
  const index = items.findIndex((item) => item === document.activeElement)
  const next = items[index === -1 ? (step > 0 ? 0 : items.length - 1) : index + step]

  next?.focus()
  return Boolean(next)
}

export function useModelPickerPanel(
  open: Ref<boolean>,
  currentVendorId: () => string | undefined,
  fallbackVendorId: () => string | undefined,
  hasFavorites: () => boolean,
  vendorIds: () => string[],
  searchRef: Ref<HTMLInputElement | null>,
) {
  const query = ref("")
  const scope = ref(FAVORITES_SCOPE)

  watch(open, (isOpen) => {
    if (!isOpen) return
    query.value = ""
    scope.value = hasFavorites()
      ? FAVORITES_SCOPE
      : (currentVendorId() ?? fallbackVendorId() ?? FAVORITES_SCOPE)
  })

  function focusSearch() {
    searchRef.value?.focus()
  }

  function selectScope(next: string) {
    query.value = ""
    scope.value = next
  }

  function cycleScope(event: KeyboardEvent) {
    event.stopPropagation()
    const order = [FAVORITES_SCOPE, ...vendorIds()]
    const index = order.indexOf(scope.value)
    const next = order[(index + (event.shiftKey ? -1 : 1) + order.length) % order.length]

    if (next) selectScope(next)
  }

  function onPanelKeydown(event: KeyboardEvent) {
    const target = event.target

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const panel = event.currentTarget

      if (!(panel instanceof HTMLElement) || !(target instanceof HTMLElement)) return

      if (target !== searchRef.value && !target.matches("[data-menu-item]")) return
      event.preventDefault()

      if (!moveFocus(panel, event.key === "ArrowDown" ? 1 : -1)) focusSearch()
      return
    }

    if (event.key !== "/") return

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    event.stopPropagation()
    focusSearch()
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !query.value) return
    event.preventDefault()
    query.value = ""
  }

  return {
    query,
    scope,
    selectScope,
    cycleScope,
    onPanelKeydown,
    onSearchKeydown,
  }
}
