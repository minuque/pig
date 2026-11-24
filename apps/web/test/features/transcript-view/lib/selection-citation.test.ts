import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createSelectionRangeAnchor,
  isSelectionRectVisible,
  observeSelectionActions,
  resolveSelectionActionPosition,
} from "@features/transcript-view/lib/selection-citation.js"

class StubDOMRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.left = x
    this.top = y
    this.right = x + width
    this.bottom = y + height
  }

  toJSON() {
    return this
  }
}

function makeRectList(rects: StubDOMRect[]): DOMRectList {
  return Object.assign([...rects], {
    item: (index: number) => rects[index] ?? null,
  }) as unknown as DOMRectList
}

function makeEmitter() {
  const listeners = new Map<string, Set<(event: unknown) => void>>()
  return {
    addEventListener(type: string, fn: (event: unknown) => void) {
      let set = listeners.get(type)

      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }

      set.add(fn)
    },
    removeEventListener(type: string, fn: (event: unknown) => void) {
      listeners.get(type)?.delete(fn)
    },
    emit(type: string, event: unknown) {
      for (const fn of listeners.get(type) ?? []) fn(event)
    },
    count() {
      return [...listeners.values()].reduce((sum, set) => sum + set.size, 0)
    },
  }
}

describe("selection-citation", () => {
  const originalDomRect = globalThis.DOMRect

  afterEach(() => {
    globalThis.DOMRect = originalDomRect
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("checks visibility against intersecting clip rects", () => {
    expect(
      isSelectionRectVisible({ left: 10, top: 20, right: 80, bottom: 40 }, [
        { left: 0, top: 0, right: 100, bottom: 100 },
      ]),
    ).toBe(true)

    expect(
      isSelectionRectVisible({ left: 10, top: 20, right: 80, bottom: 40 }, [
        { left: 0, top: 0, right: 100, bottom: 100 },
        { left: 0, top: 50, right: 100, bottom: 100 },
      ]),
    ).toBe(false)
  })

  it("places the action button below the bottom-right edge clamped to source and viewport bounds", () => {
    expect(
      resolveSelectionActionPosition({
        bounds: { left: 0, top: 0, width: 900, height: 700 },
        sourceBounds: { left: 120, right: 620 },
        selectionRect: { right: 540, bottom: 240 },
        viewport: { width: 1000, height: 800 },
      }),
    ).toEqual({ x: 540, y: 244 })

    expect(
      resolveSelectionActionPosition({
        bounds: { left: 0, top: 0, width: 900, height: 700 },
        sourceBounds: { left: 120, right: 620 },
        selectionRect: { right: 820, bottom: 240 },
        viewport: { width: 1000, height: 800 },
      }),
    ).toEqual({ x: 620, y: 244 })
  })

  it("clamps virtual anchor to source bounds and retains last rect when range collapses", () => {
    globalThis.DOMRect = StubDOMRect as unknown as typeof DOMRect
    let connected = true
    let collapsed = false
    let clientRects = [new StubDOMRect(100, 100, 300, 20), new StubDOMRect(100, 124, 520, 20)]
    const source = {
      get isConnected() {
        return connected
      },
      getBoundingClientRect: () => new StubDOMRect(80, 100, 420, 120),
    } as unknown as HTMLElement
    const range = {
      get collapsed() {
        return collapsed
      },
      getClientRects: () => makeRectList(clientRects),
      getBoundingClientRect: () => clientRects[0] ?? new StubDOMRect(),
    } as unknown as Range
    const anchor = createSelectionRangeAnchor(source, range)

    expect(anchor.getBoundingClientRect()).toMatchObject({
      left: 100,
      top: 124,
      right: 500,
      width: 400,
      height: 20,
    })

    clientRects = [new StubDOMRect(150, 200, 200, 20)]
    expect(anchor.getBoundingClientRect()).toMatchObject({ left: 150, top: 200, width: 200 })

    collapsed = true
    connected = false
    expect(anchor.getBoundingClientRect()).toMatchObject({ left: 150, top: 200, width: 200 })
  })

  it("tracks drag release, scroll restore, escape cancel, and outside dismissal cleanly", () => {
    vi.useFakeTimers()
    const doc = makeEmitter()
    const view = makeEmitter()
    const element = makeEmitter()
    const insideTarget = {
      closest: () => null,
    }
    const outsideTarget = {
      closest: () => null,
    }
    const buttonEl = {
      contains: (node: unknown) => node === buttonEl,
    } as unknown as HTMLElement
    let actionShown = false
    const onSelection = vi.fn(() => {
      actionShown = true
    })
    const onDismiss = vi.fn(() => {
      actionShown = false
    })

    Object.assign(doc, { activeElement: null })
    Object.assign(element, {
      ownerDocument: Object.assign(doc, {
        defaultView: Object.assign(view, {
          setTimeout,
          clearTimeout,
          requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
          cancelAnimationFrame: clearTimeout,
        }),
      }),
      contains: (node: unknown) => node === insideTarget,
    })

    const controller = observeSelectionActions({
      element: element as unknown as HTMLElement,
      getActionElement: () => (actionShown ? buttonEl : null),
      restoreAfterScroll: true,
      immediateMultiClick: true,
      onSelection,
      onDismiss,
    })

    doc.emit("pointerdown", { isPrimary: true, button: 0, target: insideTarget })
    element.emit("pointerdown", {
      isPrimary: true,
      button: 0,
      defaultPrevented: false,
      target: insideTarget,
    })
    controller.selectionChanged()
    expect(onSelection).not.toHaveBeenCalled()

    view.emit("mouseup", { button: 0, detail: 1, clientX: 200, clientY: 300 })
    vi.runAllTimers()
    expect(onSelection).toHaveBeenCalledTimes(1)

    element.emit("scroll", {})
    expect(onDismiss).toHaveBeenCalledWith("cancel")
    vi.advanceTimersByTime(150)
    vi.runAllTimers()
    expect(onSelection).toHaveBeenCalledTimes(2)

    doc.emit("pointerdown", { isPrimary: true, button: 0, target: outsideTarget })
    view.emit("pointerup", { isPrimary: true, button: 0 })
    expect(onDismiss).toHaveBeenLastCalledWith("cancel")
    controller.selectionChanged()
    vi.runAllTimers()
    expect(onSelection).toHaveBeenCalledTimes(3)

    doc.emit("keydown", { key: "Escape", target: outsideTarget })
    expect(onDismiss).toHaveBeenLastCalledWith("cancel")
    controller.selectionChanged()
    vi.runAllTimers()
    expect(onSelection).toHaveBeenCalledTimes(3)

    controller.dispose()
    expect(doc.count()).toBe(0)
    expect(view.count()).toBe(0)
    expect(element.count()).toBe(0)
  })
})
