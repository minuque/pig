export interface FlipSnapshot {
  el: HTMLElement
  visualLeft: number
  visualTop: number
  layoutLeft: number
  layoutTop: number
}

export interface FlipTracker {
  capture(elements: Iterable<HTMLElement>): FlipSnapshot[]
  play(snapshot: readonly FlipSnapshot[], reducedMotion: boolean): void
  cancelAll(): void
}

export function getTransformOffset(el: HTMLElement): { x: number; y: number } {
  const view = el.ownerDocument.defaultView ?? window
  const transform = view.getComputedStyle(el).transform

  if (!transform || transform === "none") return { x: 0, y: 0 }

  const Matrix = view.DOMMatrixReadOnly ?? globalThis.DOMMatrixReadOnly

  if (!Matrix) return { x: 0, y: 0 }

  try {
    const matrix = new Matrix(transform)
    return { x: matrix.m41, y: matrix.m42 }
  } catch {
    return { x: 0, y: 0 }
  }
}

export function createFlipTracker(): FlipTracker {
  const running = new Map<HTMLElement, Animation>()

  function stop(el: HTMLElement) {
    const anim = running.get(el)

    if (!anim) return
    running.delete(el)
    anim.cancel()
  }

  function cancelAll() {
    for (const [el, anim] of running) {
      running.delete(el)
      anim.cancel()
    }
  }

  function capture(elements: Iterable<HTMLElement>): FlipSnapshot[] {
    const seen = new Set<HTMLElement>()
    const snapshot: FlipSnapshot[] = []

    for (const el of elements) {
      if (!el.isConnected || seen.has(el)) continue
      seen.add(el)
      const rect = el.getBoundingClientRect()
      const offset = getTransformOffset(el)

      snapshot.push({
        el,
        visualLeft: rect.left,
        visualTop: rect.top,
        layoutLeft: rect.left - offset.x,
        layoutTop: rect.top - offset.y,
      })
    }

    return snapshot
  }

  function play(snapshot: readonly FlipSnapshot[], reducedMotion: boolean) {
    if (reducedMotion) {
      cancelAll()
      return
    }

    for (const entry of snapshot) {
      if (!entry.el.isConnected) {
        stop(entry.el)
        continue
      }

      const rect = entry.el.getBoundingClientRect()
      const offset = getTransformOffset(entry.el)
      const afterLayoutLeft = rect.left - offset.x
      const afterLayoutTop = rect.top - offset.y

      if (
        Math.abs(afterLayoutLeft - entry.layoutLeft) <= 0.5 &&
        Math.abs(afterLayoutTop - entry.layoutTop) <= 0.5
      )
        continue

      stop(entry.el)
      const dx = entry.visualLeft - afterLayoutLeft
      const dy = entry.visualTop - afterLayoutTop

      if ((Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) || typeof entry.el.animate !== "function")
        continue

      const anim = entry.el.animate(
        [{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: "translate3d(0, 0, 0)" }],
        { duration: 180, easing: "cubic-bezier(0.17, 1, 0.32, 1)" },
      )

      running.set(entry.el, anim)
      const cleanup = () => {
        if (running.get(entry.el) === anim) running.delete(entry.el)
      }

      anim.onfinish = cleanup
      anim.oncancel = cleanup
    }
  }

  return { capture, play, cancelAll }
}
