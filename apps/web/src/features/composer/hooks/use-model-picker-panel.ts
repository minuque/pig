import { nextTick, ref, watch, type Ref } from "vue"
import { FAVORITES_SCOPE } from "@features/composer/lib/model-preset.js"

function eventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target
  if (target instanceof Node) return target.parentElement
  return null
}

/** 与 ModelEffortMenu content 的 data-model-effort-menu 对应。 */
function isEffortMenuEvent(event: Event): boolean {
  const detail = (event as CustomEvent<{ originalEvent?: Event }>).detail
  const el = eventElement(detail?.originalEvent?.target ?? event.target)
  return Boolean(el?.closest("[data-model-effort-menu]"))
}

function focusPickerRail(root: HTMLElement | null) {
  const el =
    root?.querySelector<HTMLElement>(".rail-btn[data-current]") ??
    root?.querySelector<HTMLElement>(".search-hint")
  el?.focus()
}

/** 打开态：搜索、厂商轨、嵌套思考档菜单不关外层。 */
export function useModelPickerPanel(
  open: Ref<boolean>,
  currentVendorId: () => string | undefined,
  fallbackVendorId: () => string | undefined,
) {
  const query = ref("")
  const scope = ref(FAVORITES_SCOPE)
  const searching = ref(false)
  const searchRef = ref<HTMLInputElement | null>(null)
  const pickerRef = ref<HTMLElement | null>(null)
  let suppressRestore = false

  watch(open, (isOpen) => {
    if (!isOpen) return
    query.value = ""
    searching.value = false
    scope.value = currentVendorId() ?? fallbackVendorId() ?? FAVORITES_SCOPE
  })

  function enterSearch() {
    searching.value = true
    void nextTick(() => searchRef.value?.focus())
  }

  function selectScope(next: string) {
    query.value = ""
    searching.value = false
    scope.value = next
  }

  function exitSearchTo(provider: string) {
    query.value = ""
    searching.value = false
    scope.value = provider
    focusPickerRail(pickerRef.value)
  }

  function onPanelKeydown(event: KeyboardEvent) {
    if (event.key !== "/" || searching.value) return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    event.preventDefault()
    event.stopPropagation()
    enterSearch()
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !query.value) return
    event.preventDefault()
    query.value = ""
    focusPickerRail(pickerRef.value)
    searching.value = false
  }

  function onPointerDownOutside(event: Event) {
    if (isEffortMenuEvent(event)) {
      event.preventDefault()
      return
    }
    suppressRestore = true
  }

  function onFocusOutside(event: Event) {
    if (isEffortMenuEvent(event)) event.preventDefault()
  }

  function onCloseAutoFocus(event: Event) {
    if (suppressRestore) event.preventDefault()
    suppressRestore = false
  }

  function focusRail() {
    focusPickerRail(pickerRef.value)
  }

  return {
    query,
    scope,
    searching,
    searchRef,
    pickerRef,
    enterSearch,
    selectScope,
    exitSearchTo,
    onPanelKeydown,
    onSearchKeydown,
    onPointerDownOutside,
    onFocusOutside,
    onCloseAutoFocus,
    focusRail,
  }
}
