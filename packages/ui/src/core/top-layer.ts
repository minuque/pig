import { onBeforeUnmount, onMounted, watch, type Ref } from "vue"

let raising = false

function showTopPopover(el: HTMLElement) {
  if (raising || !el.isConnected || typeof el.showPopover !== "function") return
  raising = true
  try {
    if (el.matches?.(":popover-open")) el.hidePopover()
    el.showPopover()
  } catch {
  } finally {
    raising = false
  }
}

function hideTopPopover(el: HTMLElement) {
  if (typeof el.hidePopover !== "function") return
  try {
    if (el.matches?.(":popover-open")) el.hidePopover()
  } catch {}
}

export function useTopLayer(elRef: Ref<HTMLElement | null>, active: () => boolean) {
  let stopToggle: (() => void) | undefined

  function sync(open: boolean) {
    const el = elRef.value

    if (!el) return

    if (open) showTopPopover(el)
    else hideTopPopover(el)
  }

  onMounted(() => {
    const el = elRef.value

    if (!el) return

    if (typeof el.showPopover === "function") el.setAttribute("popover", "manual")
    sync(active())

    const onToggle = (event: Event) => {
      const opened = event.target

      if (
        !(event instanceof ToggleEvent ? event.newState === "open" : true) ||
        !(opened instanceof Element) ||
        opened.closest("[data-persistent-overlay]") !== null ||
        !el.isConnected ||
        !active() ||
        el.contains(opened) ||
        opened.contains(el)
      )
        return

      const doc = el.ownerDocument
      const focused = doc.activeElement instanceof HTMLElement ? doc.activeElement : null
      const keepFocus = focused && el.contains(focused) ? focused : null
      showTopPopover(el)

      if (keepFocus && doc.activeElement !== keepFocus) keepFocus.focus({ preventScroll: true })
    }

    el.ownerDocument.addEventListener("toggle", onToggle, true)
    stopToggle = () => el.ownerDocument.removeEventListener("toggle", onToggle, true)
  })

  watch(active, (open) => sync(open), { flush: "post" })

  onBeforeUnmount(() => {
    stopToggle?.()
    if (elRef.value) hideTopPopover(elRef.value)
  })
}
