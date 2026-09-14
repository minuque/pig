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

/** 打开态：搜索、厂商轨、嵌套思考档菜单不关外层。 */
export function useModelPickerPanel(
  open: Ref<boolean>,
  currentVendorId: () => string | undefined,
  fallbackVendorId: () => string | undefined,
) {
  const query = ref("")
  const scope = ref(FAVORITES_SCOPE)
  const searchRef = ref<HTMLInputElement | null>(null)
  const pickerRef = ref<HTMLElement | null>(null)
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

  function exitSearchTo(provider: string) {
    query.value = ""
    scope.value = provider
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

  return {
    query,
    scope,
    searchRef,
    pickerRef,
    selectScope,
    exitSearchTo,
    onPanelKeydown,
    onSearchKeydown,
    onPointerDownOutside,
    onFocusOutside,
    onCloseAutoFocus,
    focusSearch,
  }
}
