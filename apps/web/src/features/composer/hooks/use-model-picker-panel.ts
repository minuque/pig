import { nextTick, ref, watch, type Ref } from "vue"
import { FAVORITES_SCOPE } from "@features/composer/lib/model-preset.js"

export function useModelPickerPanel(
  open: Ref<boolean>,
  currentVendorId: () => string | undefined,
  fallbackVendorId: () => string | undefined,
  searchRef: Ref<HTMLInputElement | null>,
) {
  const query = ref("")
  const scope = ref(FAVORITES_SCOPE)
  let suppressRestore = false

  watch(open, (isOpen) => {
    if (!isOpen) return
    query.value = ""
    scope.value = currentVendorId() ?? fallbackVendorId() ?? FAVORITES_SCOPE
    void nextTick(focusSearch)
  })

  function focusSearch() {
    searchRef.value?.focus()
  }

  function selectScope(next: string) {
    query.value = ""
    scope.value = next
  }

  function onPanelKeydown(event: KeyboardEvent) {
    if (event.key !== "/") return
    const target = event.target

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

  function onPointerDownOutside() {
    suppressRestore = true
  }

  function onCloseAutoFocus(event: Event) {
    if (suppressRestore) event.preventDefault()
    suppressRestore = false
  }

  return {
    query,
    scope,
    selectScope,
    onPanelKeydown,
    onSearchKeydown,
    onPointerDownOutside,
    onCloseAutoFocus,
    focusSearch,
  }
}
