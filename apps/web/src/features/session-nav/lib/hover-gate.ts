import { shallowRef } from "vue"

const MOVE = 6

interface Point {
  x: number
  y: number
}

export const hoverBlocked = shallowRef(false)
let pointer: Point | undefined
let origin: Point | undefined

function hold(point: Point | undefined): void {
  origin = point
  hoverBlocked.value = true
}

function release(point: Point, buttons: number): void {
  if (buttons !== 0) return

  if (origin && Math.hypot(point.x - origin.x, point.y - origin.y) < MOVE) return
  origin = undefined
  hoverBlocked.value = false
}

function clear(): void {
  origin = undefined
  hoverBlocked.value = false
}

function track(event: PointerEvent): void {
  pointer = { x: event.clientX, y: event.clientY }
  release(pointer, event.buttons)
}

function press(event: PointerEvent): void {
  hold({ x: event.clientX, y: event.clientY })
}

function lift(event: PointerEvent): void {
  pointer = { x: event.clientX, y: event.clientY }
  origin = pointer
}

function holdAtPointer(): void {
  hold(pointer)
}

export function trackHoverGate(root: HTMLElement): () => void {
  const owner = root.ownerDocument
  const wheel = { capture: true, passive: true } as const

  owner.addEventListener("pointerdown", press, true)
  owner.addEventListener("pointerup", lift, true)
  owner.addEventListener("pointermove", track, true)
  owner.addEventListener("pointerover", track, true)
  owner.addEventListener("keydown", clear, true)
  root.addEventListener("wheel", holdAtPointer, wheel)
  root.addEventListener("scroll", holdAtPointer, wheel)
  return () => {
    owner.removeEventListener("pointerdown", press, true)
    owner.removeEventListener("pointerup", lift, true)
    owner.removeEventListener("pointermove", track, true)
    owner.removeEventListener("pointerover", track, true)
    owner.removeEventListener("keydown", clear, true)
    root.removeEventListener("wheel", holdAtPointer, wheel)
    root.removeEventListener("scroll", holdAtPointer, wheel)
  }
}
