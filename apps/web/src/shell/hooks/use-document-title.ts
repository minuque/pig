import { shallowRef, watch } from "vue"
import { unreadNotificationCount } from "@pig/ui/notification"

const DEFAULT_TITLE = "pig"
const baseTitle = shallowRef(DEFAULT_TITLE)
let bound = false

export function setDocumentBaseTitle(title: string | undefined): void {
  const clean = title?.trim()
  baseTitle.value = clean || DEFAULT_TITLE
}

export function bindDocumentTitle(): void {
  if (bound || typeof document === "undefined") return
  bound = true

  watch(
    [baseTitle, unreadNotificationCount],
    ([base, count]) => {
      document.title = count > 0 ? `(${count}) ${base}` : base
    },
    { immediate: true },
  )
}
