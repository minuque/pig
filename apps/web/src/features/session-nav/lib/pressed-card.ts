import { shallowRef } from "vue"

export const pressedCard = shallowRef<Element | null>(null)
let installed = false

function markCardUnderPointer(event: PointerEvent) {
  pressedCard.value =
    document.elementFromPoint(event.clientX, event.clientY)?.closest(".session-card") ?? null
}

export function trackPressedCard() {
  if (installed) return
  installed = true
  document.addEventListener("pointerdown", markCardUnderPointer, true)
  document.addEventListener("pointerup", markCardUnderPointer, true)
}
