export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches
}

const CARRY_TTL_MS = 1500
const FADE_MS = 150
const RISE_PX = 4
const carried = new Map<string, number>()

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function durationOf(name: string): number {
  return Number.parseFloat(cssVar(name)) || 300
}

function easingOf(name: "--ease-out" | "--ease-in-out"): string {
  return cssVar(name) || "ease-out"
}

export function carry(key: string): void {
  carried.set(key, performance.now())
}

export function arrive(key: string, el: HTMLElement | null | undefined): void {
  const at = carried.get(key)

  carried.delete(key)
  if (!el || at === undefined || performance.now() - at > CARRY_TTL_MS) return

  if (prefersReducedMotion()) return fadeSwap(el)
  el.animate(
    [
      { opacity: 0, transform: `translateY(${RISE_PX}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration: durationOf("--duration-slow"), easing: easingOf("--ease-out") },
  )
}

export function glide(el: HTMLElement | null | undefined, from: DOMRect | undefined): void {
  if (!el || !from || prefersReducedMotion()) return
  const to = el.getBoundingClientRect()
  const dx = from.left - to.left
  const dy = from.top - to.top

  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
  el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
    duration: durationOf("--duration-slow"),
    easing: easingOf("--ease-in-out"),
  })
}

export function fadeSwap(el: HTMLElement | null | undefined): void {
  el?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" })
}
